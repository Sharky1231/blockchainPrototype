var appname = angular.module('blockchainDemo', []);
appname.controller('mainCtrl', ['$scope', '$http', '$q', 'LoggingService',
    function ($scope, $http, $q, logs) {
        $scope.logMessages = logs.getLogMessages();
        $scope.loading = false;

        $scope.userName = '';
        $scope.functionName = '';
        $scope.parameters = '';

        $scope.availableFunctions = [];
        $scope.selectedFunction = '';
        $scope.functionTypes = ['Query', 'Invoke'];
        $scope.functionType = $scope.functionTypes[0];

        $scope.registerAdmin = function () {
            getData('/enrollAdmin', "Enrolling admin...");
        };

        $scope.registerUser = function () {
            let enrollUser = getData('/enrollUser/' + $scope.userName, "Registering '" + $scope.userName + "'...");

            enrollUser.then(() => {
                var getMethods = getData('/query/' + $scope.userName + "/getAvailFunctions", "Getting available functions...");

                getMethods.then((data) => {
                    $scope.availableFunctions = JSON.parse(data);
                    $scope.selectedFunction = $scope.availableFunctions[0];
                });
            });
        };

        $scope.executeFunction = function () {
            let request = getData('/' +
                $scope.functionType + '/' +
                $scope.userName + "/" +
                $scope.selectedFunction + "/" +
                $scope.parameters.trim(),
                "Executing '" + $scope.functionType + "' " + $scope.selectedFunction + "' as '" + $scope.userName + "' with parameters: " + $scope.parameters);
            request.then((data) => {
                var jsonData = JSON.parse(data);
                // logs.addMessage(jsonData);
                logs.addListOfMessages(jsonData);
            });
        };


        function getData(path, introMessage) {
            // perform some asynchronous operation, resolve or reject the promise when appropriate.
            return $q(function (resolve, reject) {
                logs.addMessage(introMessage);
                $scope.loading = true;

                $http.get(path, {timeout: 10000}).then(function successCallback(response) {
                    let messages = response.data.messages;
                    let data = response.data.data;
                    let err = response.data.err;

                    logs.addListOfMessages(messages);

                    if (err.length > 0) {
                        logs.addListOfMessages(err);
                        $scope.loading = false;
                        reject(err);
                        return;
                    }


                    $scope.loading = false;
                    resolve(data);
                }, function errorCallback(response) {
                    $scope.loading = false;
                    logs.addMessage("Failed: request timed out!");
                    reject();
                });
            });
        }

        $scope.resetLog = function() {
            logs.resetLogs();
            $scope.logMessages = logs.getLogMessages();
        }

    }])
    .factory('LoggingService', ['$window', function (win) {
        let logMessages = [];

        return {
            addListOfMessages: function logMessage(messages) {
                if (!Array.isArray(messages)) {
                    this.addMessage(messages);
                    return;
                }
                for (let i = 0; i < messages.length; i++) {
                    logMessages.push(messages[i]);
                }
            },

            addMessage: function addMessage(message) {
                logMessages.push(message);
            },

            getLogMessages: function getLogMessages() {
                return logMessages;
            },

            resetLogs: function resetLogs() {
                logMessages = [];
            }
        }
    }]);


