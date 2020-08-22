'use strict'

/** @type {import('@adonisjs/lucid/src/Schema')} */
const Schema = use('Schema')

class TrackingSchema extends Schema {
  up () {
    this.create('trackings', (table) => {
      table.increments()
      table.string('description');
      table.string('file');
      table.integer('user_id');
      table.integer('user_destino_id');
      table.integer('tramite_id').notNullable();
      table.integer('dependencia_origen_id').notNullable();
      table.integer('dependencia_destino_id').notNullable();
      table.boolean('current').defaultTo(true);
      table.boolean('parent').defaultTo(false);
      table.enum('status', ['REGISTRADO', 'PENDIENTE', 'ACEPTADO', 'DERIVADO', 'FINALIZADO', 'RECHAZADO', 'ANULADO', 'ENVIADO', 'RESPONDIDO']).defaultTo('PENDIENTE');
      table.boolean('state').defaultTo(true);
      table.timestamps()
    })
  }

  down () {
    this.drop('trackings')
  }
}

module.exports = TrackingSchema
