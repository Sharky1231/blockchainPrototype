/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/

'use strict';
const shim = require('fabric-shim');
const util = require('util');

let Chaincode = class {

    // The Init method is called when the Smart Contract 'fabcar' is instantiated by the blockchain network
    // Best practice is to have any Ledger initialization in separate function -- see initLedger()
    async Init(stub) {
        console.info('=========== Instantiated fabcar chaincode ===========');
        return shim.success();
    }

    // The Invoke method is called as a result of an application request to run the Smart Contract
    // 'fabcar'. The calling application program has also specified the particular smart contract
    // function to be called, with arguments
    async Invoke(stub) {
        let ret = stub.getFunctionAndParameters();
        console.info(ret);

        let method = this[ret.fcn];
        if (!method) {
            console.error('no function of name:' + ret.fcn + ' found');
            throw new Error('Received unknown function ' + ret.fcn + ' invocation');
        }
        try {
            let payload = await method(stub, ret.params);
            return shim.success(payload);
        } catch (err) {
            console.log(err);
            return shim.error(err);
        }
    }

    async initLedger(stub, args) {
        console.info('============= START : Initialize Ledger ===========');
        let permissions = [];

        // for(let i = 0; i < 1; i++){
        //     permissions.push({
        //         actor: 'doctor' + i,
        //         password: 'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb',
        //         subjects: {id: 15000, write: 'true', granted: 'false'},
        //         granted: []
        //     });
        // }
        //
        //
        // for (let i = 0; i < permissions.length; i++) {
        //     await stub.putState('PERMISSION' + i, Buffer.from(JSON.stringify(permissions[i])));
        //     console.info('Added <--> ', permissions[i]);
        // }
        console.info('============= END : Initialize Ledger ===========');
    }

    async getAvailFunctions(stub, args) {
        let functionNames = [
            'queryPermission',
            'queryAllPermissions',
            'createRecord',
            'verifyUser',
            'revokePermission',
            'grantPermission'
        ];

        return Buffer.from(JSON.stringify(functionNames));
    }

    async queryPermission(stub, args) {
        if (args.length != 1) {
            throw new Error('Incorrect number of arguments. Expecting permissionID');
        }
        let permissionId = args[0];

        let permissionInBytes = await stub.getState(permissionId);
        if (!permissionInBytes || permissionInBytes.toString().length <= 0) {
            throw new Error(permissionId + ' does not exist: ');
        }
        console.log(permissionInBytes.toString());
        return permissionInBytes;
    }

    async verifyUser(stub, args) {
        if (args.length != 2) {
            throw new Error('Incorrect number of arguments. Expecting permission ID and hashed password');
        }

        let permissionId = args[0];
        let hashedPass = args[1];

        let permissionInBytes = await stub.getState(permissionId);


        if(!permissionInBytes){
            throw new Error('Hashed public key not found!');
        }

        var temp = JSON.parse(permissionInBytes.toString());

        // probably return only bytes??
        if(temp.password === hashedPass) {
            return permissionInBytes;
        }

        else {
            throw new Error('Incorrect log in. (*Password does not match)');
        }
    }

    async queryAllPermissions(stub, args) {

        // let startKey = 'PERMISSION0';
        // let endKey = 'PERMISSION999';

        let iterator = await stub.getStateByRange('', '');

        let allResults = [];
        while (true) {
            let res = await iterator.next();

            if (res.value && res.value.value.toString()) {
                let jsonRes = {};
                console.log(res.value.value.toString('utf8'));

                jsonRes.Key = res.value.key;
                try {
                    jsonRes.Record = JSON.parse(res.value.value.toString('utf8'));
                } catch (err) {
                    console.log(err);
                    jsonRes.Record = res.value.value.toString('utf8');
                }
                allResults.push(jsonRes);
            }
            if (res.done) {
                console.log('end of data');
                await iterator.close();
                console.info(allResults);
                return Buffer.from(JSON.stringify(allResults));
            }
        }
    }

    async createRecord(stub, args) {
        console.info('============= START : Create Permission ===========');
        if (args.length < 2) {
            throw new Error('Incorrect number of arguments. Expecting "PermissionKey", "Actor" and subjects with permissions.');
        }

        let subjects = [];

        for(let i = 3; i < args.length; i+=3){
            subjects.push({id: args[i], write: args[i+1], granted: args[i+2]});
        }

        let permission = {
            actor: args[1],
            password: args[2],
            subject: subjects,
            granted: []
        };

        await stub.putState(args[0], Buffer.from(JSON.stringify(permission)));
        console.info('============= END : Create Permission ===========');
    }

    async grantPermission(stub, args) {
        if (args.length != 4) {
            throw new Error('Grant permission: Incorrect number of arguments.');
        }

        let fromUserId = args[0];
        let toUserId = args[1];
        let patientId = args[2];
        let canWrite = args[3];

        let fromUser = JSON.parse(await stub.getState(fromUserId));
        let toUser = JSON.parse(await stub.getState(toUserId));

        if(!fromUser || !toUser){
            throw new Error('One of the user were not found!');
        }

        for(let i = 0; i < fromUser.subject.length; i++){
            if(fromUser.subject[i].id === patientId && fromUser.subject[i].granted == 'true'){
                throw new Error('Permission cannot be granted further');
            }
        }

        for(let i = 0; i < toUser.subject.length; i++){
            if(toUser.subject[i].id === patientId)
                throw new Error('Patient already assigned to ' + toUserId);
        }

        fromUser.granted.push({receiver: toUser.actor, patientId: patientId, permissionType: (canWrite === 'true' ? 'write' : 'read')});
        toUser.subject.push({id: patientId, write: canWrite, granted: 'true'});

        await stub.putState(fromUserId, Buffer.from(JSON.stringify(fromUser)));
        await stub.putState(toUserId, Buffer.from(JSON.stringify(toUser)));
    }

    async revokePermission(stub, args) {
        if (args.length != 4) {
            throw new Error('Revoke permission: Incorrect number of arguments.');
        }

        let fromUserId = args[0];
        let toUserId = args[1];
        let patientId = args[2];
        let permissionType = args[3];

        let fromUser = JSON.parse(await stub.getState(fromUserId));
        let toUser = JSON.parse(await stub.getState(toUserId));


        for(let i = 0; i < toUser.subject.length; i++){
            if(toUser.subject[i].id === patientId){
                toUser.subject.splice(i, 1);
                break;
            }
        }

        for(let m = 0; m < fromUser.granted.length; m++){
            if(fromUser.granted[m].receiver === toUser.actor && fromUser.granted[m].permissionType === permissionType && fromUser.granted[m].patientId === patientId){
                fromUser.granted.splice(m, 1);
                break;
            }
        }

        await stub.putState(toUserId, Buffer.from(JSON.stringify(toUser)));
        await stub.putState(fromUserId, Buffer.from(JSON.stringify(fromUser)));
    }
};

shim.start(new Chaincode());
