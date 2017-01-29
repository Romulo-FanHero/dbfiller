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

const maxStaff = maxUsers / 10;
const addrPerStaff = 2;

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
        email: faker.internet.email().toLowerCase(),
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

const geraFuncionario = () => {
    return {
        nome: escQuotes(faker.name.firstName()),
        sobrenome: escQuotes(faker.name.lastName()),
        email_pessoal: faker.internet.email().toLowerCase(),
        email_empresa: `${faker.internet.userName().toLowerCase()}@cbtu.gov.br`,
        cpf: faker.random.number({ min: 11111111111, max: 99999999999 }),
        data_insercao: faker.date.between(minDate, maxDate).toISOString()
    };
};

const main = () => {

    return clearAll()

        // PREENCHE USUARIOS
        .then(result => {
            var len = maxUsers, users = [];
            while (len--) { users.push(geraUsuario()); }
            const qry = squel.insert().into(`${nspc}.usuario`).setFieldsRows(users);
            return simpleQuery2(`${qry} ON CONFLICT DO NOTHING`);
        })

        // PREENCHE ENDERECOS DE USUARIOS
        .then(() => {
            console.log(`${maxUsers} usuarios escritos com sucesso`);
            var len = maxUsers * addrPerUser, addrList = [];
            while (len--) { addrList.push(geraEndereco()); }
            const qry = squel.insert().into(`${nspc}.endereco`).setFieldsRows(addrList);
            return simpleQuery2(`${qry} ON CONFLICT DO NOTHING`);
        })

        // PREENCHE RELACIONAMENTO USUARIOS X ENDERECOS
        .then(() => {
            console.log(`${maxUsers * addrPerUser} enderecos de usuarios escritos com sucesso`);
            var outList = [], endereco_id = 1;
            for (var i = 1, ilen = addrPerUser; i <= ilen; i++) {
                for (var j = 1, jlen = maxUsers; j <= jlen; j++) {
                    outList.push({
                        usuario_id: j,
                        funcionario_id: null,
                        estacao_id: null,
                        tipo_endereco_id: 0,
                        endereco_id: endereco_id
                    });
                    endereco_id++;
                }
            }
            const qry = squel.insert().into(`${nspc}.lista_endereco`).setFieldsRows(outList);
            return simpleQuery2(`${qry} ON CONFLICT DO NOTHING`);
        })

        // PREENCHE FUNCIONARIOS
        .then(() => {
            console.log(`${maxUsers * addrPerUser} usuarios x enderecos escritos com sucesso`);
            var len = maxStaff, outList = [];
            while (len--) { outList.push(geraFuncionario()); }
            const qry = squel.insert().into(`${nspc}.funcionario`).setFieldsRows(outList);
            return simpleQuery2(`${qry} ON CONFLICT DO NOTHING`);
        })

        // PREENCHE ENDERECOS DE FUNCIONARIOS
        .then(() => {
            console.log(`${maxStaff} funcionarios escritos com sucesso`);
            var len = maxStaff * addrPerStaff, addrList = [];
            while (len--) { addrList.push(geraEndereco()); }
            const qry = squel.insert().into(`${nspc}.endereco`).setFieldsRows(addrList);
            return simpleQuery2(`${qry} ON CONFLICT DO NOTHING`);
        })

        // PREENCHE RELACIONAMENTO FUNCIONARIOS X ENDERECOS
        .then(() => {
            console.log(`${maxStaff * addrPerStaff} enderecos de funcionarios escritos com sucesso`);
            var outList = [], endereco_id = maxUsers * addrPerUser + 1;
            for (var i = 1, ilen = addrPerStaff; i <= ilen; i++) {
                for (var j = 1, jlen = maxStaff; j <= jlen; j++) {
                    outList.push({
                        usuario_id: null,
                        funcionario_id: j,
                        estacao_id: null,
                        tipo_endereco_id: 1,
                        endereco_id: endereco_id
                    });
                    endereco_id++;
                }
            }
            const qry = squel.insert().into(`${nspc}.lista_endereco`).setFieldsRows(outList);
            return simpleQuery2(`${qry} ON CONFLICT DO NOTHING`);
        })


        .then(() => {
            console.log(`${maxStaff * addrPerStaff} funcionarios x enderecos escritos com sucesso`);
            process.exit();
        })
        .catch(err => {
            console.error(err);
        });

};

main();
