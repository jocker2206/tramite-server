'use strict'

const collect = require('collect.js');
const File = use('App/Models/File');
const Tramite = use('App/Models/Tramite');
const Tracking = use('App/Models/Tracking');
const NotFoundModelException = require('../../Exceptions/NotFoundModelException')

class TimelineController {

    // obtener entitdad
    _entity = async (request, tramite) => {
        let entity = await request.api_authentication.get(`entity/${tramite.entity_id || '_error'}`)
            .then(res => res.data)
            .catch(err => ({}));
        return entity;
    }

    // obtener dependencias
    _dependencias = async (request, tramite, trackings) => {
        let db = collect(trackings.data);
        let plucked = db.pluck('dependencia_origen_id', 'dependencia_destino_id');
        let ids = collect([
            ...plucked.keys().toArray(), 
            ...plucked.values().toArray(),
            tramite.dependencia_origen_id
        ]).toArray();
        // obtener dependencias
        let { dependencia } = await request.api_authentication.get(`dependencia?ids[]=${ids.join('&ids[]=')}`)
            .then(res => res.data)
            .catch(err => ({
                success: false,
                status: err.status || 501,
                dependencia: { data: [] }
            }));
        // response
        return collect(dependencia.data);
    }

    // obtener remitentes
    _people = async (request, tramite, trackings) => {
        let db = collect(trackings.data);
        let plucked = db.pluck('person_id');
        let ids = collect([
            ...plucked.keys().toArray(), 
            ...plucked.values().toArray(),
            tramite.person_id
        ]).toArray();
        let people = await request.api_authentication.get(`find_people?id[]=${ids.join('&id[]=')}`)
            .then(res => res.data)
            .catch(err => ([]));
        // response
        return collect(people);
    }

    // obtener archivos
    _files = async (request, tramite, trackings) => {
        let db = collect(trackings.data);
        let plucked = db.pluck('id', 'tramite_id');
        let ids = collect([
            ...plucked.keys().toArray(), 
            ...plucked.values().toArray(),
            tramite.id
        ]).toArray();
        let files = await File.query()
            .whereIn('object_type', ['App/Models/Tramite', 'App/Models/Tracking'])
            .whereIn('object_id', ids)
            .fetch();
        files = await files.toJSON();
        // response
        return collect(files);
    }

    // línea de tiempo y trámite
    handle = async ({ params, request }) => {
        let { page, query_search } = request.all();
        let tramite = await Tramite.query()
            .with('tramite_type')
            .where('slug', params.slug)
            .first();
        if (!tramite) throw new NotFoundModelException('El trámite');
        // obtener tracking
        let trackings = await Tracking.query()
            .where('tramite_id', tramite.id)
            .whereIn('status', ['REGISTRADO', 'DERIVADO', 'ACEPTADO', 'RECHAZADO', 'RESPONDIDO', 'ANULADO', 'FINALIZADO'])
            .paginate(page || 1, 20);
        trackings = await trackings.toJSON();
        // obtener dependencias
        let entity = await this._entity(request, tramite);
        let dependencias = await this._dependencias(request, tramite, trackings);
        let people = await this._people(request, tramite, trackings);
        let files = await this._files(request, tramite, trackings);
        // configurar datos
        await trackings.data.map(tra => {
            tra.dependencia = dependencias.where('id', tra.dependencia_id).first() || {};
            tra.dependencia_origen = dependencias.where('id', tra.dependencia_origen_id).first() || {};
            tra.dependencia_destino = dependencias.where('id', tra.dependencia_destino_id).first() || {};
            tra.person = people.where('id', tra.person_id).first() || {};
            tra.files = files.where('object_type', 'App/Models/Tracking').where('object_id', tra.id).toArray() || [];
            return tra;
        });
        // trámite
        tramite.entity = entity;
        tramite.person = people.where('id', tramite.person_id).first() || {};
        tramite.dependencia_origen = dependencias.where('id', tramite.dependencia_origen_id).first() || {};
        tramite.files = files.where('object_type', 'App/Models/Tramite').where('object_id', tramite.id).toArray() || [];
        // response
        return {
            success: true,
            status: 201,
            tramite,
            trackings
        };
    }

}

module.exports = TimelineController
