'use strict'

const Tramite = use('App/Models/Tramite');
const Event = use('Event');
const codeQR = require('qrcode');
const Env = use('Env');
const TramiteEntity = require('../../Entities/TramiteEntity');
const NotFoundModelException = require('../../Exceptions/NotFoundModelException');
const Tracking = use('App/Models/Tracking');

class TramiteController {

    async index({ request }) {
        let authentication = request.api_authentication;
        let page = request.input('page', 1)
        let query_search = request.input('query_search', '')
        const tramiteEntity = new TramiteEntity(authentication);
        const tramites = await tramiteEntity.index({ page, query_search });
        return {
            success: true,
            status: 200,
            tramites
        }
    }

    // crear tramite interno
    store = async ({ request }) => {
        const authentication = request.api_authentication;
        const auth = request.$auth;
        const entity = request.$entity;
        const dependencia = request.$dependencia;
        const tramiteEntity = new TramiteEntity(authentication);
        const datos = request.all();
        datos.entity_id = entity.id;
        datos.dependencia_id = dependencia.id;
        let next = request.input('next');
        let tramite = await tramiteEntity.store(request, datos, auth, next);
        // notificar por email
        Event.fire('tramite::new', request, tramite, tramite.person, auth.person, dependencia);
        // notificar por socket
        let socket = request.$io();
        socket.emit('Tramite/TramiteListener.store', { tramite, tracking: tramite.tracking });
        // enviar notification
        Event.fire('tramite::notification', request, tramite, tramite.tracking);
        // response
        return {
            success: true,
            status: 201,
            message: "El tramite se creó correctamente",
            tramite
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

    // anular tramite
    async anularProcess ({ params, request }) {
        let auth = request.$auth;
        let tramite = await Tramite.query() 
            .where('person_id', auth.person_id)
            .where('id', params.id)
            .where('state', 1)
            .first();
        if (!tramite) throw new NotFoundModelException("El trámite");
        // deshabilitar trámite
        tramite.merge({ state: 0 });
        await tramite.save();
        // generar columna de eliminado y ocultar tracking
        await Tracking.query()
            .where('tramite_id', tramite.id)
            .update({ current: 0, visible: 0 });
        // crear registro de anulación
        let tracking = await Tracking.create({
            tramite_id: tramite.id,
            dependencia_id:  tramite.dependencia_origen_id,
            person_id: auth.person_id,
            user_verify_id: auth.id,
            user_id: auth.id,
            revisado: 1,
            visible: 1,
            current: 1,
            modo: 'YO',
            status: 'ANULADO'
        });
        // response
        return {
            success: true,
            status: 201,
            message: "El proceso del trámite se anuló correctamente!",
            tracking
        }
    }

    async update ({ params, request }) {
        let datos = request.all();
        let auth = request.$auth;
        let tramiteEntity = new TramiteEntity();
        let tramite = await tramiteEntity.update(params.id, datos, auth.id);
        return {
            success: true,
            status: 201,
            message: "El trámite se actulizó correctamente!",
            tramite
        }
    }

    async delete({ params, request }) {
        const authentication = request.api_authentication;
        const tramiteEntity = new TramiteEntity(authentication);
        await tramiteEntity.delete(params.id);
        return { 
            success: true,
            status: 201,
            message: "El tramite se eliminó correctamente!"
        }
    }
}

module.exports = TramiteController
