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
        permissions.push({
            actor: 'doctor1',
            subject: ['p1', 'p2'],
        });
        permissions.push({
            actor: 'doctor2',
            subject: ['p3'],
        });

        for (let i = 0; i < permissions.length; i++) {
            await stub.putState('PERMISSION' + i, Buffer.from(JSON.stringify(permissions[i])));
            console.info('Added <--> ', permissions[i]);
        }
        console.info('============= END : Initialize Ledger ===========');
    }

    async getAvailFunctions(stub, args) {
        let functionNames = [
            'queryPermission',
            'queryAllPermissions',
            'createRecord',
            // 'transferPermission',
        ];

        return Buffer.from(JSON.stringify(functionNames));
    }

    async queryPermission(stub, args) {
        if (args.length != 1) {
            throw new Error('Incorrect number of arguments. Expecting permissionID ex: PERMISSION0');
        }
        let permissionId = args[0];

        let permissionInBytes = await stub.getState(permissionId); //get the car from chaincode state
        if (!permissionInBytes || permissionInBytes.toString().length <= 0) {
            throw new Error(permissionId + ' does not exist: ');
        }
        console.log(permissionInBytes.toString());
        return permissionInBytes;
    }

    async queryAllPermissions(stub, args) {

        let startKey = 'PERMISSION0';
        let endKey = 'PERMISSION999';

        let iterator = await stub.getStateByRange(startKey, endKey);

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
            throw new Error('Incorrect number of arguments. Expecting "PermissionKey", "Actor" and (optional) comma separated subjects');
        }

        let subjects = [];

        for(let i = 2; i < args.length; i++){
            subjects.push(args[i]);
        }

        let permission = {
            actor: args[1],
            subject: subjects,
        };

        await stub.putState(args[0], Buffer.from(JSON.stringify(permission)));
        console.info('============= END : Create Permission ===========');
    }

    async transferPermission(stub, args) {
        console.info('============= START : changeCarowner ===========');
        if (args.length != 2) {
            throw new Error('Incorrect number of arguments. Expecting 2');
        }

        let carAsBytes = await stub.getState(args[0]);
        let car = JSON.parse(carAsBytes);
        car.owner = args[1];

        await stub.putState(args[0], Buffer.from(JSON.stringify(car)));
        console.info('============= END : changeCarowner ===========');
    }
};

shim.start(new Chaincode());
