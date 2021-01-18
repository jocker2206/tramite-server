'use strict'

const Helpers = use('Helpers');
const Drive = use('Drive');
const p = require('path');
const { Storage, validation } = require('validator-error-adonis');
const uid = require('uid');
const { LINK } = require('../../../utils');
const File = use('App/Models/File');
const { validateAll } = use('Validator');
const CustomException = require('../../Exceptions/CustomException')
const NotFoundModelException = require('../../Exceptions/NotFoundModelException')


class FileController {

    allow = [
        'App/Models/Tramite',
        'App/Models/Tracking'
    ];

    // crear archivo
    store = async ({ request }) => {
        let catchRequest = {
            object_type: request.input('object_type', request.object_type || ""),
            object_id: request.input('object_id', request.object_id || "")
        };
        // validación
        await validation(validateAll, catchRequest, {
            object_type: 'required',
            object_id: 'required',
        });
        // request
        let { object_id, object_type } = catchRequest;
        // validar objecto
        if (!this.allow.includes(object_type)) throw new CustomException("El objecto no está permitido!", "ERR_NOT_ALLOW_OBJECT", 403)
        let Object = use(object_type);
        let obj = await Object.find(object_id);
        if (!obj) throw new NotFoundModelException("El objecto");
        // archivo
        let file = await Storage.saveFile(request, "files", {
            multifiles: true,
            required: true,
            size: "6mb"
        }, Helpers, {
            path: `${object_type.split('/').pop()}/${uid(10)}`.toLowerCase(),
            options: {
                overwrite: true
            }
        })
        // precargar datos
        let payload = [];
        await file.files.map(f => {
            payload.push({
                name: f.name,
                object_id,
                object_type,
                extname: f.extname,
                size: f.size,
                url: LINK("tmp", f.path),
                real_path: f.realPath
            });
        });
        // crear files
        let files = await File.createMany(payload);
        // response
        return { 
            success: true,
            status: 201,
            message: "El archivo se guardo correctamente!",
            files
        }
    }

    // obtener archivo
    handle = async ({ request, response }) => {
        let disk = request.input('disk', 'tmp');
        let path = request.input('path');
        if (!path) throw new Error("La ruta es obligatoria");
        let link = Helpers.appRoot(p.join(disk, path));
        let exists = await Drive.exists(link);
        if (!exists) throw new Error("No se encontró el archivo");
        let name = `${path}`.split('/').pop();
        response.header('Content-Disposition', `inline; filename="${name}"`);
        return response.download(link);
    }

    // obtener files de los objects
    object_type = async ({ params, request }) => {
        let { object_type } = request.all();
        if (!this.allow.includes(object_type)) throw new CustomException("El tipo de objecto no está permitido", "ERR_ALLOW_OBJECT_TYPE", 501);
        let { page } = request.all();
        let Object = use(object_type);
        let obj = await Object.find(params.object_id);
        if (!obj) throw new NotFoundModelException("El objeto");
        // obtener archivos
        let files = await File.query()
            .where('object_type', object_type)
            .where('object_id', obj.id)
            .paginate(page || 1, 20);
        // response
        return {
            status: 201,
            success: true,
            object: obj,
            files
        }
    };
}

module.exports = FileController
