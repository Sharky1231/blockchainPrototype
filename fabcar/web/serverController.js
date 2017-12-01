'use strict';

let Fabric_Client = require('fabric-client');
let Fabric_CA_Client = require('fabric-ca-client');
let path = require('path');
let util = require('util');
let os = require('os');
var atob = require('atob');
let jwt = require('jsonwebtoken');
let dbCtrl = require('./databaseController');

const store_path = path.join(__dirname, 'hfc-key-store');
let fabric_ca_client = null;
let fabric_client = new Fabric_Client();

let secret = '1s5aBmdX9GU7cvChcrwrzTHcvfhjmbQWEEhguiiNmdjchvkeoora';
let publicKeyHashed = '';

// var fabric_client = new Fabric_Client();
// var fabric_ca_client = null;
// var admin_user = null;
// var member_user = null;
// var store_path = path.join(__dirname, 'hfc-key-store');
// var tx_id = null;

let response = {
    data: [],
    messages: [],
    err: [],
    token: ''
};

exports.showIndex = function (req, res) {
    res.sendFile(__dirname + '/index.html');
};

exports.enrollAdmin = function (req, res) {
    return new Promise((resolve, reject) => {
        initResponse(req);

        if (validateToken(req)) {
            resolve(res.json(response));
            return;
        }

        let admin_user = null;

        console.log("Store path: " + store_path);
        fabric_ca_client = null;
        fabric_client = new Fabric_Client();

        let userFromPersistence = getUserFromPersistence(true, 'admin', true);

        userFromPersistence.then((user_from_store) => {
            if (user_from_store && user_from_store.isEnrolled()) {
                console.log('Successfully loaded admin from persistence');
                admin_user = user_from_store;
                return null;
            } else {
                // need to enroll it with CA server
                return fabric_ca_client.enroll({
                    enrollmentID: 'admin',
                    enrollmentSecret: 'adminpw'
                }).then((enrollment) => {
                    console.log('Successfully enrolled admin user "admin"');
                    return fabric_client.createUser(
                        {
                            username: 'admin',
                            mspid: 'Org1MSP',
                            cryptoContent: {
                                privateKeyPEM: enrollment.key.toBytes(),
                                signedCertPEM: enrollment.certificate
                            }
                        });
                }).then((user) => {
                    admin_user = user;
                    return fabric_client.setUserContext(admin_user);
                }).catch((err) => {
                    console.log('Failed to enroll and persist admin. Error: ' + err.stack ? err.stack : err);
                    response.err.push('Failed to enroll and persist admin. Error: ' + err.stack ? err.stack : err);
                });
            }
        }).then(() => {
            console.log('Assigned the admin user to the fabric client ::' + admin_user.toString());
            response.messages.push("Admin successfully enrolled: '" + admin_user.getName().toString() + "' associated with '" + admin_user.getSigningIdentity().getMSPId() + "'");
        }).catch((err) => {
            console.log('Failed to enroll admin: ' + err);
            response.err.push('Failed to enroll admin: ' + err);
        }).then(() => {
            // CREATE SAMPLE NURSE
            req.params.userId = '112';
            req.params.password = 'a';
            req.params.hashedPass = 'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb';
            req.params.functionName = 'createRecord';
            req.params.patients = '1403981125,false,false,2610911471,false,false,1105903699,false,true';
            req.params.createNewFabricClient = false;
            req.headers.authorization = generateToken(req);
            req.doNotResolve = true;
            return exports.enrollUser(req, res);
        }).then(() => {
            // CREATE SAMPLE DOCTOR 1
            req.params.userId = '113';
            req.params.password = 'a';
            req.params.hashedPass = 'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb';
            req.params.functionName = 'createRecord';
            req.params.patients = '1403981125,true,false';
            req.params.createNewFabricClient = false;
            req.headers.authorization = generateToken(req);
            req.doNotResolve = true;
            return exports.enrollUser(req, res);
        }).then(() => {
            // CREATE SAMPLE DOCTOR 2
            req.params.userId = '114';
            req.params.password = 'a';
            req.params.hashedPass = 'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb';
            req.params.functionName = 'createRecord';
            req.params.patients = '2610911471,true,false,1105903699,false,true';
            req.params.createNewFabricClient = false;
            req.headers.authorization = generateToken(req);
            req.doNotResolve = true;
            return exports.enrollUser(req, res);
        }).then(() => {
            console.log(response);
            publicKeyHashed = 'admin';
            response.token = generateToken(req);
            resolve(res.json(response));
        });
    });
};

exports.enrollUser = function (req, res) {
    return new Promise((resolve, reject) => {
        initResponse(req);

        let userName = req.params.userId;
        let password = req.params.hashedPass;

        fabric_client = new Fabric_Client();
        fabric_ca_client = null;
        let admin_user = null;
        let member_user = null;
        console.log("Trying register: " + userName);
        console.log('Store path:' + store_path);

        dbCtrl.verifyActorInDB(req).then((actor) => {

            if (!actor) {
                response.err.push("User not found in DB");
                resolve(res.json(response));
                return;
            }
            else
                response.data.push(actor);


            let userFromPersistence = getUserFromPersistence(false, 'admin', true);

            userFromPersistence.then((user_from_store) => {
                if (user_from_store && user_from_store.isEnrolled()) {
                    console.log('Successfully loaded admin from persistence');
                    admin_user = user_from_store;
                } else {
                    response.err.push('Failed to get admin.... run enrollAdmin.js');
                    resolve(res.json(response));
                }

                // at this point we should have the admin user
                // first need to register the user with the CA server
                return fabric_ca_client.register({enrollmentID: userName, affiliation: 'org1.department1'}, admin_user);
            }).then((userSecret) => {
                // next we need to enroll the user with CA server
                if (userSecret !== undefined) {
                    console.log('Successfully registered: ' + userName + ' - secret:' + userSecret);
                }

                return fabric_ca_client.enroll({enrollmentID: userName, enrollmentSecret: userSecret});
            }).then((enrollment) => {
                response.messages.push('Successfully enrolled member user: ' + userName);
                return fabric_client.createUser(
                    {
                        username: userName,
                        mspid: 'Org1MSP',
                        cryptoContent: {privateKeyPEM: enrollment.key.toBytes(), signedCertPEM: enrollment.certificate}
                    });
            }).then((user) => {
                member_user = user;
                let publicKey = user._identity._publicKey._key.pubKeyHex;
                publicKeyHashed = user.getCryptoSuite().hash(publicKey, 'SHA2');
                return fabric_client.setUserContext(member_user);
            }).then(() => {

                // response.messages.push(fabric_client.getClientConfig());
                response.messages.push(userName + ': was successfully registered and enrolled.');

                // exports.invoke(req, res);
            }).catch((err) => {
                response.err.push('Failed to register: ' + err);
                if (err.toString().indexOf('Authorization') > -1) {
                    response.err.push('Authorization failures may be caused by having admin credentials from a previous CA instance.\n' +
                        'Try again after deleting the contents of the store directory ' + store_path);
                }
                resolve(res.json(response));
            }).then(() => {
                // register user in the ledger and create default permission with empty subjects
                req.params.userId = userName;
                req.params.password = password;
                req.params.functionName = 'createRecord';

                if (!req.params.patients)
                    req.params.parameters = publicKeyHashed + ',' + userName + ',' + password;
                else
                    req.params.parameters = publicKeyHashed + ',' + userName + ',' + password + ',' + req.params.patients;
                req.params.createNewFabricClient = false;
                req.headers.authorization = generateToken(req);
                return exports.invoke(req, res);
            }).then(() => {
                if (req.doNotResolve) {
                    resolve(true);
                    return;
                }
                resolve(res.json(response));
            })
        });
    });
};

exports.loginUser = function (req, res) {
    return new Promise((resolve, reject) => {
        initResponse(req);

        getUserFromPersistence(false, req.params.userId, false).then((user) => {
            if (user === null) {
                throw new Error('User not found');
            }

            let publicKey = user._identity._publicKey._key.pubKeyHex;
            publicKeyHashed = user.getCryptoSuite().hash(publicKey, 'SHA2');

            req.headers.authorization = generateToken(req);

            req.params.functionName = 'verifyUser';
            req.params.parameters = publicKeyHashed + ',' + req.params.hashedPass;
            req.params.createNewFabricClient = false;
            req.params.returnData = true;
            return exports.queryMethod(req, res)
        }).then(() => {
            response.token = generateToken(req);
            resolve(res.json(response));
        }).catch((err) => {
            console.log(err.message);
            response.err.push(err.message);
            resolve(res.json(response));
        });
    });
};

exports.grantPermission = function (req, res) {
    req.params.functionName = "grantPermission";
    invokePermission(req, res);
};

exports.revokePermission = function (req, res) {
    req.params.functionName = "revokePermission";
    invokePermission(req, res);
};

let invokePermission = function(req, res){
    return new Promise((resolve, reject) => {
        initResponse(req);

        if (!exports.isValidToken(req)) {
            response.err.push("Error: token invalid");
            resolve(res.json(response));
            return;
        }

        let userId = req.params.userId;
        let patientId = req.params.patientId;
        let permissionType = req.params.permissionType;
        let reciever = req.params.reciever;

        let userPublicHash = '';
        let recieverPublicHash = '';

        // Get hashed public key of the user granting permission
        getUserFromPersistence(false, req.params.userId, false).then((user) => {
            let publicKey = user._identity._publicKey._key.pubKeyHex;
            userPublicHash = user.getCryptoSuite().hash(publicKey, 'SHA2');

            // Get hashed public key of the reciever
            return getUserFromPersistence(false, reciever, false)
        }).then((recieverData) => {

            if(recieverData === null){
                response.err.push("Receiver '"+reciever+ "' not found!");
                resolve(res.json(response));
                return;
            }

            let publicKey = recieverData._identity._publicKey._key.pubKeyHex;
            recieverPublicHash = recieverData.getCryptoSuite().hash(publicKey, 'SHA2');

            // Invoke grant permission method on chaincode
            req.params.userId = userId;
            req.params.parameters = userPublicHash + ',' + recieverPublicHash + ',' + patientId + ',' + permissionType;
            req.params.createNewFabricClient = false;
            req.doNotResolve = true;
            return exports.invoke(req, res);
        }).then((invokedSuccesfuly) => {
            if(invokedSuccesfuly)
                response.data.push("Permission of '" + patientId + "'successfully granted to: " + reciever);
            else
                response.err.push(patientId + "'is already assigned to: " + reciever);

            resolve(res.json(response));
            return;
        });
    });
};

exports.queryMethodNoParameters = function (req, res) {
    exports.queryMethod(req, res);
};

exports.queryMethod = function (req, res) {
    return new Promise((resolve, reject) => {
        initResponse(req);

        if (!exports.isValidToken(req)) {
            response.err.push("Error: token invalid");
            resolve(res.json(response));
        }

        let queryResponse = '';
        response.token = req.headers.authorization;

        var userName = req.params.userId;
        var functionName = req.params.functionName;
        var parameters = [];
        if (req.params.parameters) {
            parameters = req.params.parameters.split(',');
        }

        fabric_client = new Fabric_Client();
        var member_user = null;


// setup the fabric network

        let userFromPersistence = getUserFromPersistence(false, userName, false);

        userFromPersistence.then((user_from_store) => {
            if (user_from_store && user_from_store.isEnrolled()) {
                console.log('Successfully loaded ' + userName + ' from persistence');
                member_user = user_from_store;
            } else {
                response.err.push('Failed to get ' + userName + '.... run registerUser.js');
                throw new Error('Failed to get ' + userName + '.... run registerUser.js');
            }

            return queryChainCode(fabric_client, functionName, parameters);

        }).then((query_responses) => {
            console.log("Query has completed, checking results");
            // query_responses could have more than one  results if there multiple peers were used as targets
            if (query_responses && query_responses.length == 1) {
                if (query_responses[0] instanceof Error) {
                    console.log("error from query = ", query_responses.toString());
                    response.err.push("Failed with ", query_responses[0].message);
                } else {
                    console.log("Response is ", query_responses[0].toString());
                    queryResponse = query_responses[0].toString();
                    response.data.push(query_responses[0].toString());
                }
            } else {
                console.log("No payloads were returned from query");
            }
        }).catch((err) => {
            response.err.push('Failed to query successfully :: ' + err);
        }).then(() => {
            if (req.params.returnData) {
                resolve(queryResponse);
                return;
            }

            resolve(res.json(response));

        });
    });
};

exports.invoke = function (req, res) {
    return new Promise((resolve, reject) => {

        if (!exports.isValidToken(req))
            resolve(res.json(response));

        var userName = req.params.userId;
        var functionName = req.params.functionName;
        var parameters = [];
        if (req.params.parameters) {
            parameters = req.params.parameters.split(',');
        }
        console.log(parameters);
        console.log("CREATE CLIENT: " + req.params.createNewFabricClient);


        if (req.params.createNewFabricClient === null || req.params.createNewFabricClient) {
            initResponse(req);
            console.log('inside');
            fabric_client = new Fabric_Client();
        }


        let channel = '';
        let order = fabric_client.newOrderer('grpc://localhost:7050');
        // setup the fabric network

        try {
            channel = fabric_client.getChannel('mychannel');
        }
        catch(err){
            channel = fabric_client.newChannel('mychannel');
            let peer = fabric_client.newPeer('grpc://localhost:7051');
            channel.addPeer(peer);
        }

        if(channel.getOrderers().length === 0)
            channel.addOrderer(order);

        response.messages.push("All initialized");
        var member_user = null;
        var tx_id = null;

        var userFromPersistence = getUserFromPersistence(false, userName, false);

        userFromPersistence.then((user_from_store) => {
            if (user_from_store && user_from_store.isEnrolled()) {
                console.log('Successfully loaded ' + userName + ' from persistence');
                member_user = user_from_store;
            } else {
                response.err.push('Failed to get ' + userName + '.... run registerUser.js');
                throw new Error('Failed to get ' + userName + '.... run registerUser.js');
            }

            // get a transaction id object based on the current user assigned to fabric client
            tx_id = fabric_client.newTransactionID();
            console.log("Assigning transaction_id: ", tx_id._transaction_id);
            response.messages.push("Assigning transaction_id: ", tx_id._transaction_id);

            console.log('here');
            // createCar chaincode function - requires 5 args, ex: args: ['CAR12', 'Honda', 'Accord', 'Black', 'Tom'],
            // changeCarOwner chaincode function - requires 2 args , ex: args: ['CAR10', 'Barry'],
            // must send the proposal to endorsing peers
            var request = {
                //targets: let default to the peer assigned to the client
                chaincodeId: 'fabcar',
                fcn: functionName,
                args: parameters,
                chainId: 'mychannel',
                txId: tx_id
            };

            // send the transaction proposal to the peers
            return channel.sendTransactionProposal(request);
        }).then((results) => {
            var proposalResponses = results[0];
            var proposal = results[1];
            let isProposalGood = false;
            if (proposalResponses && proposalResponses[0].response &&
                proposalResponses[0].response.status === 200) {
                isProposalGood = true;
                console.log('Transaction proposal was good');
            } else {
                console.error('Transaction proposal was bad');
            }
            if (isProposalGood) {
                console.log(util.format(
                    'Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s"',
                    proposalResponses[0].response.status, proposalResponses[0].response.message));
                response.messages.push(util.format(
                    'Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s"',
                    proposalResponses[0].response.status, proposalResponses[0].response.message));

                // build up the request for the orderer to have the transaction committed
                var request = {
                    proposalResponses: proposalResponses,
                    proposal: proposal
                };

                // set the transaction listener and set a timeout of 30 sec
                // if the transaction did not get committed within the timeout period,
                // report a TIMEOUT status
                var transaction_id_string = tx_id.getTransactionID(); //Get the transaction ID string to be used by the event processing
                var promises = [];

                var sendPromise = channel.sendTransaction(request);
                promises.push(sendPromise); //we want the send transaction first, so that we know where to check status

                // get an eventhub once the fabric client has a user assigned. The user
                // is required bacause the event registration must be signed
                let event_hub = fabric_client.newEventHub();
                event_hub.setPeerAddr('grpc://localhost:7053');

                // using resolve the promise so that result status may be processed
                // under the then clause rather than having the catch clause process
                // the status
                let txPromise = new Promise((resolve, reject) => {
                    let handle = setTimeout(() => {
                        event_hub.disconnect();
                        resolve({event_status: 'TIMEOUT'}); //we could use reject(new Error('Trnasaction did not complete within 30 seconds'));
                    }, 3000);
                    event_hub.connect();
                    event_hub.registerTxEvent(transaction_id_string, (tx, code) => {
                        // this is the callback for transaction event status
                        // first some clean up of event listener
                        clearTimeout(handle);
                        event_hub.unregisterTxEvent(transaction_id_string);
                        event_hub.disconnect();

                        // now let the application know what happened
                        var return_status = {event_status: code, tx_id: transaction_id_string};
                        if (code !== 'VALID') {
                            console.error('The transaction was invalid, code = ' + code);
                            response.messages.push('The transaction was invalid, code = ' + code);
                            resolve(return_status); // we could use reject(new Error('Problem with the tranaction, event status ::'+code));
                        } else {
                            console.log('The transaction has been committed on peer ' + event_hub._ep._endpoint.addr);
                            response.messages.push('The transaction has been committed on peer ' + event_hub._ep._endpoint.addr);
                            resolve(return_status);
                        }
                    }, (err) => {
                        //this is the callback if something goes wrong with the event registration or processing
                        reject(new Error('There was a problem with the eventhub ::' + err));
                    });
                });
                promises.push(txPromise);

                return Promise.all(promises);
            } else {
                console.error('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
                response.err.push('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
                resolve(false);
                throw new Error('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
            }
        }).then((results) => {
            console.log('Send transaction promise and event listener promise have completed');
            // check the results in the order the promises were added to the promise all list
            if (results && results[0] && results[0].status === 'SUCCESS') {
                console.log('Successfully sent transaction to the orderer.');
                response.messages.push('Successfully sent transaction to the orderer.');
            } else {
                response.err.push('Failed to order the transaction. Error code: ' + response.status);
                console.error('Failed to order the transaction. Error code: ' + response.status);
            }

            if (results && results[1] && results[1].event_status === 'VALID') {
                console.log('Successfully committed the change to the ledger by the peer');
                response.messages.push('Successfully committed the change to the ledger by the peer');
            } else {
                console.log('Transaction failed to be committed to the ledger due to ::' + results[1].event_status);
                response.err.push('Transaction failed to be committed to the ledger due to ::' + results[1].event_status);
            }
        }).catch((err) => {
            console.error('Failed to invoke successfully :: ' + err);
            response.err.push('Failed to invoke successfully :: ' + err);
        }).then(() => {
            if (req.doNotResolve) {
                resolve(true);
                return;
            }

            resolve(res.json(response));
        });
    });
};

exports.updateData = function (req, res) {
    return new Promise((resolve, reject) => {
        initResponse(req);

        let encodedData = req.params.encodedData;
        let decoded = atob(encodedData);
        let jsonData = JSON.parse(decoded);
        let userId = jsonData.invoker;

        if (!exports.isValidToken(req)) {
            resolve(res.json(response));
            return;
        }

        getUserFromPersistence(false, userId, false).then((user) => {
            if (user === null) {
                response.err.push('User not found');
                resolve(res.json(response));
                throw new Error('User not found');
            }
            let publicKey = user._identity._publicKey._key.pubKeyHex;
            publicKeyHashed = user.getCryptoSuite().hash(publicKey, 'SHA2');

            // Instead of querying for permission we could do the check in the chaincode and return
            req.params.userId = userId;
            req.params.functionName = 'queryPermission';
            req.params.parameters = publicKeyHashed;
            req.params.createNewFabricClient = false;
            req.params.returnData = true;
            return exports.queryMethod(req, res)
        }).then((permission) => {
            if (!permission) {
                response.err.push("Actor ID not found!");
                resolve(res.json(response));
                return;
            }

            let jsonResponse = JSON.parse(permission);
            let subjects = jsonResponse.subject;

            for (let i = 0; i < subjects.length; i++) {
                if (subjects[i].id === jsonData.cpr && subjects[i].write === 'true') {
                    dbCtrl.updateData(jsonData).then(() => {
                        resolve(res.json(response));
                    });
                    return;
                }
            }

            response.err.push("Error no write permission for: " + jsonData.cpr);
            resolve(res.json(response));
        });

    });
};

let queryChainCode = function (fabric_client, functionName, parameters) {
    return new Promise((resolve, reject) => {
        let channel = fabric_client.newChannel('mychannel');
        let peer = fabric_client.newPeer('grpc://localhost:7051');
        channel.addPeer(peer);

        const request = {
            chaincodeId: 'fabcar',
            fcn: functionName,
            args: parameters
        };

        // send the query proposal to the peer
        let response = channel.queryByChaincode(request);
        resolve(response);
    });
};

let getUserFromPersistence = function (withTlsOptions, userName, initCAclient) {
    return new Promise((resolve, reject) => {

        Fabric_Client.newDefaultKeyValueStore({
            path: store_path
        }).then((state_store) => {
            // assign the store to the fabric client
            fabric_client.setStateStore(state_store);
            var crypto_suite = Fabric_Client.newCryptoSuite();
            // use the same location for the state store (where the users' certificate are kept)
            // and the crypto store (where the users' keys are kept)
            var crypto_store = Fabric_Client.newCryptoKeyStore({path: store_path});
            crypto_suite.setCryptoKeyStore(crypto_store);
            fabric_client.setCryptoSuite(crypto_suite);
            var tlsOptions = {
                trustedRoots: [],
                verify: false
            };

            if (!initCAclient)
                resolve(fabric_client.getUserContext(userName, true));

            else if (withTlsOptions)
            // be sure to change the http to https when the CA is running TLS enabled
                fabric_ca_client = new Fabric_CA_Client('http://localhost:7054', tlsOptions, 'ca.example.com', crypto_suite);

            else
                fabric_ca_client = new Fabric_CA_Client('http://localhost:7054', null, '', crypto_suite);

            // get the enrolled user from persistence, this user will sign all requests
            resolve(fabric_client.getUserContext(userName, true));
        }).catch((err) => {
            console.log("Error occured: " + err);
            reject();
        });
    });
};

let initResponse = function (req) {
    response = {
        data: [],
        messages: [],
        err: [],
        token: req.headers.authorization
    };
};

// generate the JWT
function generateToken(req) {
    let token = jwt.sign({
        auth: publicKeyHashed,
        agent: req.headers['user-agent'],
        exp: Math.floor(new Date().getTime() / 1000) + 7 * 24 * 60 * 60
    }, secret);

    return token;
}

function validateToken(req) {
    let token = req.headers.authorization;
    let decoded = '';
    try {
        decoded = jwt.verify(token, secret);
    } catch (e) {
        return false;
    }
    if (!decoded || decoded.auth !== publicKeyHashed) {
        return false;
    } else {
        return true;
    }
}

exports.isValidToken = function (req) {
    if (validateToken(req))
        return true;

    response.err.push("Authentication failed. Token invalid or expired.")
    return false;
};