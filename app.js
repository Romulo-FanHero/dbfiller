// APP.JS

const _ = require('lodash');
const promise = require('bluebird');
const squel = require('squel').useFlavour('postgres');
const pool = new (require('pg').Pool)({
    host: 'localhost',
    port: 5432,
    user: 'ibd',
    password: 'ibd',
    database: 'metrobh',
    ssl: false,
    min: 5,
    max: 50,
    idleTimeoutMillis: 2500
});

const nspc = 'cadastro';

// Error handler required for pg clients that eventually inside the `pg.Pool`
// if the connection to the `pg.Server` is reconfigured
pool.on('error', err => {
    console.error(err);
});

// Minimalist function for executing postgres queries w/o error handling.
const simpleQuery2 = function simpleQuery2(qry) {
    var client;
    return pool.connect()
        .then(function fetch(_client) {
            client = _client;
            return client.query(qry.toString());
        })
        .then(function answer(result) {
            if (client) client.release();
            if (!result || !result.rows) return [];
            return result.rows;
        });
};

const clearAll = () => {
    return simpleQuery2(`
        TRUNCATE TABLE
            ${nspc}.endereco,
            ${nspc}.estacao,
            ${nspc}.funcionario,
            ${nspc}.lista_alocacao,
            ${nspc}.lista_endereco,
            ${nspc}.lista_gerencia,
            ${nspc}.usuario
        RESTART IDENTITY
    `);
};

const main = () => {
    return clearAll()
        .then(result => {
            console.log(JSON.stringify(result, null, 2));
        })
        .catch(err => {
            console.error(err);
        });
};

main();
