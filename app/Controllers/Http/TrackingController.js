'use strict'

const Tracking = use('App/Models/Tracking');
const File = use('App/Models/File');
const collect = require('collect.js');

class TrackingController {

    // obtener tracking
    show = async ({ params, request }) => {
        // obtener tracking
        let tracking = await Tracking.query()
            .with('verify')
            .with('tramite', (build) => {
                build.with('tramite_type');
            }).where('tramite_id', params.id)
            .first();
        // obtener tramite
        let tramite = await tracking.tramite().fetch();
        // obtener dependencias
        let dependenciaIds = [tracking.dependencia_origen_id, tracking.dependencia_destino_id, tramite.dependencia_origen_id];
        let dependencias = await request.api_authentication.get(`dependencia?ids[]=${dependenciaIds.join('&ids[]=')}`)
            .then(res => {
                let { dependencia } = res.data;
                return dependencia.data;
            }).catch(err => ([]));
        // obtener persona
        let personIds = [tracking.person_id, tramite.person_id];
        let people = await request.api_authentication.get(`find_people?id[]=${personIds.join('&id[]=')}`)
            .then(res => res.data)
            .catch(err => ([]));
        // setting collection
        dependencias = collect(dependencias);
        people = collect(people);
        // obtener code_qr;
        let code_qr = await tramite.funcCodeQr();
        // setting tracking
        tracking = await tracking.toJSON();
        tracking.person = people.where('id', tracking.person_id).first() || {};
        tracking.dependencia_origen = dependencias.where('id', tracking.dependencia_origen_id).first() || {};
        tracking.dependencia_destino = dependencias.where('id', tracking.dependencia_destino_id).first() || {};
        // setting tramite
        tracking.tramite.person = people.where('id', tracking.tramite.person_id).first() || {};
        tracking.tramite.dependencia_origen = dependencias.where('id', tracking.tramite.dependencia_origen_id).first() || {};
        // archivos
        let files = await File.query()
            .whereIn('object_type', ['App/Models/Tracking', 'App/Models/Tramite'])
            .whereIn('object_id', [tracking.id, tracking.tramite_id])
            .fetch();
        files = collect(await files.toJSON());
        // add files
        tracking.files = await files.where('object_type', 'App/Models/Tracking').where('object_id', tracking.id).toArray();
        tracking.tramite.files = await files.where('object_type', 'App/Models/Tramite').where('object_id', tracking.tramite_id).toArray();
        tracking.tramite.code_qr = code_qr;
        // response 
        return {
            success: true,
            status: 201,
            tracking
        }
    }

}

module.exports = TrackingController
