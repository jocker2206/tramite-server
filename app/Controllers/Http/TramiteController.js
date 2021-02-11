'use strict'

const { validation, ValidatorError, Storage } = require('validator-error-adonis');
const { validateAll } = use('Validator');
const TramiteType = use('App/Models/TramiteType');
const Tramite = use('App/Models/Tramite');
const uid = require('uid')
const Helpers = use('Helpers')
const { LINK, URL } = require('../../../utils')
const Event = use('Event');
const codeQR = require('qrcode');
const Env = use('Env');
const Role = use('App/Models/Role');
const FileController = require('./FileController');
const CustomException = require('../../Exceptions/CustomException');
const NotFoundModelException = require('../../Exceptions/NotFoundModelException');

class TramiteController {

    // crear tramite interno
    store = async ({ request }) => {
        await validation(validateAll, request.all(), {
            person_id: "required",
            tramite_type_id: 'required|max:11',
            document_number: 'required|min:4|max:255',
            folio_count: 'required|min:1|max:10',
            asunto: 'required|min:4'
        });
        // obtener tramite documento
        let type = await TramiteType.find(request.input('tramite_type_id'));
        if (!type) throw new ValidatorError([{ field: 'tramite_type_id', message: 'EL tipo de tramite es incorrecto' }]);
        // generar slug
        let slug = `${type.short_name}${uid(10)}`.toUpperCase().substr(0, 10);
        let tramite_parent_id = null;
        // obtener al auth y dependencia
        let auth = request.$auth;
        let entity = request.$entity;
        let dependencia = request.$dependencia;
        // verificar role
        let role = await Role.query()
            .where('entity_id', entity.id)
            .where('dependencia_id', dependencia.id)
            .where('level', 'BOSS')
            .first();
        if (!role) throw new NotFoundModelException("Al jefe");
        // validar tramite parent
        if (request.input('tramite_id')) {
            let tramite_parent = await Tramite.find(request.input('tramite_id'));
            if (!tramite_parent) throw new NotFoundModelException("El trámite raíz");
            tramite_parent_id = tramite_parent.id;
            slug = tramite_parent.slug;
        }
        // payload
        let payload = {
            entity_id: request.$entity.id,
            person_id: request.input('person_id'),
            slug,
            document_number: request.input('document_number'),
            tramite_type_id: request.input('tramite_type_id'),
            folio_count: request.input('folio_count'),
            observation: request.input('observation'),
            asunto: request.input('asunto'),
            dependencia_origen_id: dependencia.id,
            tramite_parent_id,
            user_id: auth.id,
        }
        // guardar tramite
        let tramite = await Tramite.create(payload);
        // guardar archivos
        try {
            // preparar datos
            let files = new FileController;
            request.object_type = 'App/Models/Tramite';
            request.object_id = tramite.id;
            await files.store({ request });
            // send event
            await Event.fire('tramite::tracking', request, tramite);
            Event.fire('tramite::new', request, tramite, auth.person, auth.person, dependencia);
            // response
            return {
                success: true,
                status: 201,
                code: 'RES_SUCCESS',
                message: 'El tramite se creó correctamente',
                tramite
            }
        } catch (error) {
            // eliminar tramite
            await tramite.delete();
            // ejecutar error
            throw new CustomException(error.message, error.name, error.status || 501);
        }
    }

    // generar código QR
    codeQr = async ({ params, response }) => {
        try {
            let tramite = await Tramite.findBy('slug', params.slug);
            if (!tramite) throw new Error("No se encontró el tramite");
            let link = `${Env.get('CLIENT_TRAMITE')}?slug=${tramite.slug}`;
            let code = await codeQR.toBuffer(link);
            response.header('Content-Type', 'image/png')
            return response.send(code);
        } catch (error) {
            response.status(error.status || 501);
            return response.send({
                success: false,
                status: error.status || 501,
                message: error.message
            })
        }
    }
}

module.exports = TramiteController
