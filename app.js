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

const userMinDate = new Date('2014-01-01');
const userMaxDate = new Date(Date.now());

const maxUsers = 1000000;
const addrPerUser = 4;

const maxStaff = maxUsers / 10;
const addrPerStaff = 3;

const staffMinDate = new Date('1985-01-01');
const staffMaxDate = new Date('2017-01-01');

const maxStations = maxUsers / 100;
const addrPerStation = 2;

const staffPerStation = maxStaff / maxStations;
const managersPerStation = 2;

const maxManagers = maxStations * 2;
const managersPerStaff = maxStaff / maxManagers;

const chunkSize = 5000;

// Error handler required for pg clients that eventually inside the `pg.Pool`
// if the connection to the `pg.Server` is reconfigured
pool.on('error', err => {
    console.error(err);
});

// Generate an evenly spaced numeric array from `0` to `max`, in increments of
// size `inc`
const evenlyChunks = function evenlyChunks(inc, max) {
    var s = [], c = 0;
    while (c < max) {
        s.push(c);
        c += inc;
    }
    return s;
};

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

const writeAll = (rows, table) => {
    return promise.map(
        evenlyChunks(chunkSize, rows.length),
        offset => {
            return simpleQuery2(`${squel.insert().into(`${nspc}.${table}`).setFieldsRows(rows.slice(offset, offset + chunkSize))} ON CONFLICT DO NOTHING`)
                .then(() => { console.log(`\t\t[${nspc}.${table}] chunk OK ${new Date(Date.now()).toISOString().slice(11, 22)}`); })
                .catch(err => { console.error(err); });
        },
        { concurrency: 10 }
    );
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
        data_insercao: faker.date.between(userMinDate, userMaxDate).toISOString()
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
        data_insercao: faker.date.between(staffMinDate, staffMaxDate).toISOString()
    };
};

const geraEstacao = () => {
    return {
        nome: escQuotes(faker.address.county())
    };
};

const main = () => {

    return clearAll()

        // PREENCHE USUARIOS
        .then(result => {
            var len = maxUsers, outList = [];
            while (len--) { outList.push(geraUsuario()); }
            return writeAll(outList, 'usuario');
        })

        // PREENCHE ENDERECOS DE USUARIOS
        .then(() => {
            console.log(`${maxUsers} usuarios escritos com sucesso`);
            var len = maxUsers * addrPerUser, outList = [];
            while (len--) { outList.push(geraEndereco()); }
            return writeAll(outList, 'endereco');
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
            return writeAll(outList, 'lista_endereco');
        })

        // PREENCHE FUNCIONARIOS
        .then(() => {
            console.log(`${maxUsers * addrPerUser} usuarios x enderecos escritos com sucesso`);
            var len = maxStaff, outList = [];
            while (len--) { outList.push(geraFuncionario()); }
            return writeAll(outList, 'funcionario');
        })

        // PREENCHE ENDERECOS DE FUNCIONARIOS
        .then(() => {
            console.log(`${maxStaff} funcionarios escritos com sucesso`);
            var len = maxStaff * addrPerStaff, outList = [];
            while (len--) { outList.push(geraEndereco()); }
            return writeAll(outList, 'endereco');
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
            return writeAll(outList, 'lista_endereco');
        })

        // PREENCHE ESTACOES
        .then(() => {
            console.log(`${maxStaff * addrPerStaff} funcionarios x enderecos escritos com sucesso`);
            var len = maxStations, outList = [];
            while (len--) { outList.push(geraEstacao()); }
            return writeAll(outList, 'estacao');
        })

        // PREENCHE ENDERECOS DE ESTACOES
        .then(() => {
            console.log(`${maxStations} estacoes escritas com sucesso`);
            var len = (maxStations * addrPerStation), outList = [];
            while (len--) { outList.push(geraEndereco()); }
            return writeAll(outList, 'endereco');
        })

        // PREENCHE RELACIONAMENTO ESTACOES X ENDERECOS
        .then(() => {
            console.log(`${maxStations * addrPerStation} enderecos de estacoes escritos com sucesso`);
            var outList = [], endereco_id = (maxUsers * addrPerUser) + (maxStaff * addrPerStaff) + 1;
            for (var i = 1, ilen = addrPerStation; i <= ilen; i++) {
                for (var j = 1, jlen = maxStations; j <= jlen; j++) {
                    outList.push({
                        usuario_id: null,
                        funcionario_id: null,
                        estacao_id: j,
                        tipo_endereco_id: 2,
                        endereco_id: endereco_id
                    });
                    endereco_id++;
                }
            }
            return writeAll(outList, 'lista_endereco');
        })

        // PREENCHE RELACIONAMENTO FUNCIONARIOS X ESTACOES
        .then(() => {
            console.log(`${maxStations * addrPerStation} estacoes x enderecos escritos com sucesso`);
            var outList = [], estacao_id = 1;
            for (var i = 1, len = maxStaff; i <= len; i++) {
                outList.push({
                    funcionario_id: i,
                    estacao_id: estacao_id
                });
                estacao_id++;
                if (estacao_id > maxStations) estacao_id = 1;
            }
            return writeAll(outList, 'lista_alocacao');
        })

        // PREENCHE RELACIONAMENTO FUNCIONARIOS GERENTES X ESTACOES
        .then(() => {
            console.log(`${maxStaff} funcionarios x estacoes escritos com sucesso`);
            var outList = [], estacao_id = 1;
            for (var i = 1, len = maxManagers; i <= len; i++) {
                outList.push({
                    funcionario_id: i,
                    estacao_id: estacao_id
                });
                estacao_id++;
                if (estacao_id > maxStations) estacao_id = 1;
            }
            return writeAll(outList, 'lista_gerencia');
        })

        .then(() => {
            console.log(`${maxManagers} funcionarios gerentes x estacoes escritos com sucesso`);
            process.exit();
        })
        .catch(err => {
            console.error(err);
            process.exit();
        });

};

main();
