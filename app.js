// APP.JS

const _ = require('lodash');
const faker = require('faker');
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

const minDate = new Date('2014-01-01');
const maxDate = new Date('2017-01-01');

const maxUsers = 10000;
const addrPerUser = 3;

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

const escQuotes = function escQuotes(str) {
    if (!str) return null;
    return str.replace(/'/g, `''`);
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

const geraUsuario = () => {
    return {
        nome: escQuotes(faker.name.firstName()),
        sobrenome: escQuotes(faker.name.lastName()),
        email: faker.internet.email(),
        data_insercao: faker.date.between(minDate, maxDate).toISOString()
    };
};

const geraEndereco = () => {
    return {
        rotulo: escQuotes(faker.lorem.sentence()),
        logradouro: escQuotes(faker.address.streetAddress()),
        complemento: escQuotes(faker.address.secondaryAddress()),
        municipio: escQuotes(faker.address.city()),
        estado: escQuotes(faker.address.stateAbbr()),
        cep: faker.address.zipCode('#####')
    };
};

const main = () => {
    return clearAll()
        .then(result => {
            var len = maxUsers, users = [];
            while (len--) { users.push(geraUsuario()); }
            const qry = squel.insert().into(`${nspc}.usuario`).setFieldsRows(users);
            return simpleQuery2(`${qry} ON CONFLICT DO NOTHING`);
        })
        .then(() => {
            console.log(`${maxUsers} usuarios escritos com sucesso`);
            var len = maxUsers * addrPerUser, addrList = [];
            while (len--) { addrList.push(geraEndereco()); }
            const qry = squel.insert().into(`${nspc}.endereco`).setFieldsRows(addrList);
            return simpleQuery2(`${qry} ON CONFLICT DO NOTHING`);
        })
        .then(() => {
            console.log(`${maxUsers * addrPerUser} enderecos escritos com sucesso`);
            process.exit();
        })
        .catch(err => {
            console.error(err);
        });
};

main();
