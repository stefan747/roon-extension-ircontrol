"use strict";

var util = require('util');
var IRControl = require('lirc_node'),
RoonApi = require("node-roon-api"),
RoonApiSettings = require('node-roon-api-settings'),
RoonApiStatus = require('node-roon-api-status'),
RoonApiVolumeControl = require('node-roon-api-volume-control'),
RoonApiSourceControl = require('node-roon-api-source-control');

var Bottleneck = require('bottleneck');
var express = require('express');
var crypto = require('crypto');
var os = require('os');

function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (let k in interfaces) {
        for (let k2 in interfaces[k]) {
            let address = interfaces[k][k2];
            if (address.family === 'IPv4' && !address.internal) {
                return address.address;
            }
        }
    }
    return '127.0.0.1';
}

const limiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 333
});

var roon = new RoonApi({
		extension_id: 'com.stefan747.roon.IRControl',
		display_name: 'IR Control',
		display_version: "2.0.0",
		publisher: 'Stefan Kruzlik',
		email: 'stefan.kruzlik@gmail.com',
		website: 'https://github.com/stefan747/roon-extension-IRControl'
	});

var mysettings = roon.load_config("settings") || {
	remotes: {}
};

if (!mysettings.webhookPort) {
    mysettings.webhookPort = 3000;
}
if (!mysettings.webhookAuthToken) {
    mysettings.webhookAuthToken = crypto.randomBytes(16).toString('hex');
    roon.save_config("settings", mysettings);
}

var irdevice = {
	remotes: {}
};

function makelayout(settings) {
    var l = {
        values: settings,
        layout: [],
        has_error: false
    };

    var globalGroup = {
        type: "group",
        title: "Global Webhook Settings",
        collapsable: true,
        items: [
            {
                type: "integer",
                title: "Webhook Port",
                min: 1024,
                max: 65535,
                setting: "webhookPort"
            }
        ]
    };
    l.layout.push(globalGroup);

    for (var lircRemote in irdevice.control.remotes) {
        var commands = irdevice.control.remotes[lircRemote].map(function (cmd) {
            return {
                title: cmd,
                value: cmd
            };
        });
        var remoteGroup = {
            type: "group",
            title: lircRemote,
            collapsable: true,
            items: []
        };
        let volumeControl = {
            type: "dropdown",
            title: "Volume Control",
            values: [{
                title: "N",
                value: "N"
            }, {
                title: "Y",
                value: "Y"
            }
            ],
            setting: lircRemote + "_volumeControl"
        };
        remoteGroup.items.push(volumeControl);

        if (settings[lircRemote + "_volumeControl"] == "Y") {
            remoteGroup.items.push({
                type: "dropdown",
                title: "Volume Up",
                values: [{
                    title: "(select command)",
                    value: undefined
                }
                ].concat(commands),
                setting: lircRemote + "_volumeUp"
            });
            remoteGroup.items.push({
                type: "dropdown",
                title: "Volume Down",
                values: [{
                    title: "(select command)",
                    value: undefined
                }
                ].concat(commands),
                setting: lircRemote + "_volumeDown"
            });
            remoteGroup.items.push({
                type: "dropdown",
                title: "Mute",
                values: [{
                    title: "(select command)",
                    value: undefined
                }
                ].concat(commands),
                setting: lircRemote + "_mute"
            });

        }
        let sourceControl = {
            type: "dropdown",
            title: "Source Control",
            values: [{
                title: "N",
                value: "N"
            }, {
                title: "Y",
                value: "Y"
            }
            ],
            setting: lircRemote + "_1_sourceControl"
        };
        remoteGroup.items.push(sourceControl);

        if (settings[lircRemote + "_1_sourceControl"] == "Y") {
            settings[lircRemote + "_1_webhookUrl"] = `http://${getLocalIp()}:${settings.webhookPort || 3000}/switch/${lircRemote}/1?token=${settings.webhookAuthToken}`;
            remoteGroup.items.push({
                type: "string",
                title: "Webhook URL",
                setting: lircRemote + "_1_webhookUrl"
            });

            remoteGroup.items.push({
                type: "dropdown",
                title: "Power On",
                values: [{
                    title: "(select command)",
                    value: undefined
                }
                ].concat(commands),
                setting: lircRemote + "_1_powerOn"
            });
            remoteGroup.items.push({
                type: "integer",
                title: "Power On Retry Count",
                min: 0,
                max: 10,
                setting: lircRemote + "_1_powerOnRetry"
            });
            remoteGroup.items.push({
                type: "integer",
                title: "Power On Retry Interval (ms)",
                min: 100,
                max: 10000,
                setting: lircRemote + "_1_powerOnRetryInterval"
            });
            remoteGroup.items.push({
                type: "dropdown",
                title: "Power Off",
                values: [{
                    title: "(select command)",
                    value: undefined
                }
                ].concat(commands),
                setting: lircRemote + "_1_powerOff"
            });
            remoteGroup.items.push({
                type: "integer",
                title: "Power Off Retry Count",
                min: 0,
                max: 10,
                setting: lircRemote + "_1_powerOffRetry"
            });
            remoteGroup.items.push({
                type: "integer",
                title: "Power Off Retry Interval (ms)",
                min: 100,
                max: 10000,
                setting: lircRemote + "_1_powerOffRetryInterval"
            });
            remoteGroup.items.push({
                type: "dropdown",
                title: "Input Select Type",
                values: [{
                    title: "Discrete",
                    value: "Discrete"
                }, {
                    title: "Sequential",
                    value: "Sequential"
                }, {
                    title: "Up/Down",
                    value: "UpDown"
                }
                ],
                setting: lircRemote + "_1_inputSelectType"
            });

            if (settings[lircRemote + "_1_inputSelectType"] === "Sequential") {
                remoteGroup.items.push({
                    type: "dropdown",
                    title: "Input Select",
                    values: [{
                        title: "(select command)",
                        value: undefined
                    }
                    ].concat(commands),
                    setting: lircRemote + "_1_inputSelect"
                });
                remoteGroup.items.push({
                    type: "integer",
                    title: "Number of Inputs",
                    min: 1,
                    max: 20,
                    setting: lircRemote + "_1_numInputs"
                });
                remoteGroup.items.push({
                    type: "integer",
                    title: "Requested Input Number",
                    min: 1,
                    max: 20,
                    setting: lircRemote + "_1_requestedInput"
                });
                remoteGroup.items.push({
                    type: "string",
                    title: "Requested Input Name",
                    minlength: 10,
                    setting: lircRemote + "_1_requestedInputName"
                });
                remoteGroup.items.push({
                    type: "integer",
                    title: "Input Change Delay (ms)",
                    min: 0,
                    max: 10000,
                    setting: lircRemote + "_1_inputChangeDelay"
                });
            } else if (settings[lircRemote + "_1_inputSelectType"] === "UpDown") {
                remoteGroup.items.push({
                    type: "dropdown",
                    title: "Input Select Up",
                    values: [{
                        title: "(select command)",
                        value: undefined
                    }
                    ].concat(commands),
                    setting: lircRemote + "_1_inputSelectUp"
                });
                remoteGroup.items.push({
                    type: "dropdown",
                    title: "Input Select Down",
                    values: [{
                        title: "(select command)",
                        value: undefined
                    }
                    ].concat(commands),
                    setting: lircRemote + "_1_inputSelectDown"
                });
                remoteGroup.items.push({
                    type: "integer",
                    title: "Number of Inputs",
                    min: 1,
                    max: 20,
                    setting: lircRemote + "_1_numInputs"
                });
                remoteGroup.items.push({
                    type: "integer",
                    title: "Requested Input Number",
                    min: 1,
                    max: 20,
                    setting: lircRemote + "_1_requestedInput"
                });
                remoteGroup.items.push({
                    type: "string",
                    title: "Requested Input Name",
                    minlength: 10,
                    setting: lircRemote + "_1_requestedInputName"
                });
                remoteGroup.items.push({
                    type: "integer",
                    title: "Input Change Delay (ms)",
                    min: 0,
                    max: 10000,
                    setting: lircRemote + "_1_inputChangeDelay"
                });
            } else if (settings[lircRemote + "_1_inputSelectType"] === "Discrete") {
                remoteGroup.items.push({
                    type: "dropdown",
                    title: "Input Select",
                    values: [{
                        title: "(select command)",
                        value: undefined
                    }
                    ].concat(commands),
                    setting: lircRemote + "_1_inputSelect"
                });
            }

            remoteGroup.items.push({
                type: "dropdown",
                title: "Volume reset on Input Change",
                values: [{
                    title: "N",
                    value: "N"
                }, {
                    title: "Y",
                    value: "Y"
                }
                ],
                setting: lircRemote + "_1_volumeResetOnInputChange"
            });
            remoteGroup.items.push({
                type: "integer",
                title: "Initial Volume 'button hold' (ms)",
                min: 0,
                max: 10000,
                setting: lircRemote + "_1_initialvolume"
            });

            remoteGroup.items.push({
                type: "integer",
                title: "Startup Time (s)",
                min: 0,
                max: 100,
                setting: lircRemote + "_1_startuptime"
            });
            remoteGroup.items.push({
                type: "integer",
                title: "Startup Delay (s)",
                min: 0,
                max: 100,
                setting: lircRemote + "_1_startupDelay"
            });

            // Only show Source Control 2 if Input Select Type is selected
            if (settings[lircRemote + "_1_inputSelectType"]) {
                let i = 1;
                while (settings[lircRemote + "_" + (i++) + "_sourceControl"] == "Y") {

                    let sourceControl = {
                        type: "dropdown",
                        title: "Source Control " + i,
                        values: [{
                            title: "N",
                            value: "N"
                        }, {
                            title: "Y",
                            value: "Y"
                        }
                        ],
                        setting: lircRemote + "_" + i + "_sourceControl"
                    };
                    remoteGroup.items.push(sourceControl);

                    if (settings[lircRemote + "_" + i + "_sourceControl"] == "Y") {
                        settings[lircRemote + "_" + i + "_webhookUrl"] = `http://${getLocalIp()}:${settings.webhookPort || 3000}/switch/${lircRemote}/${i}?token=${settings.webhookAuthToken}`;
                        remoteGroup.items.push({
                            type: "string",
                            title: "Webhook URL",
                            setting: lircRemote + "_" + i + "_webhookUrl"
                        });
                        if (settings[lircRemote + "_1_inputSelectType"] === "Sequential" || settings[lircRemote + "_1_inputSelectType"] === "UpDown") {
                            remoteGroup.items.push({
                                type: "integer",
                                title: "Requested Input Number",
                                min: 1,
                                max: 20,
                                setting: lircRemote + "_" + i + "_requestedInput"
                            });
                            remoteGroup.items.push({
                                type: "string",
                                title: "Requested Input Name",
                                maxlength: 10,
                                setting: lircRemote + "_" + i + "_requestedInputName"
                            });
                        } else {
                            remoteGroup.items.push({
                                type: "dropdown",
                                title: "Input Select",
                                values: [{
                                    title: "(select command)",
                                    value: undefined
                                }
                                ].concat(commands),
                                setting: lircRemote + "_" + i + "_inputSelect"
                            });
                        }
                        remoteGroup.items.push({
                            type: "integer",
                            title: "Initial Volume 'button hold' (ms)",
                            min: 0,
                            max: 10000,
                            setting: lircRemote + "_" + i + "_initialvolume"
                        });

                    }
                }
            }
        }
        l.layout.push(remoteGroup);
    }

    return l;
}

var svc_settings = new RoonApiSettings(roon, {
		get_settings: function (cb) {
			cb(makelayout(mysettings));
		},
		save_settings: function (req, isdryrun, settings) {
			let l = makelayout(settings.values);
			req.send_complete(l.has_error ? "NotValid" : "Success", {
				settings: l
			});

			if (!isdryrun && !l.has_error) {
				mysettings = l.values;
				svc_settings.update_settings(l);
				setup();
				roon.save_config("settings", mysettings);
			}
		}
	});

var svc_status = new RoonApiStatus(roon);
var svc_volume_control = new RoonApiVolumeControl(roon);
var svc_source_control = new RoonApiSourceControl(roon);

roon.init_services({
	provided_services: [svc_volume_control, svc_source_control, svc_settings, svc_status]
});

let expressApp = null;
let expressServer = null;

function startExpressServer() {
    if (expressServer) {
        expressServer.close(() => {
            expressServer = null;
            initExpressServer();
        });
    } else {
        initExpressServer();
    }
}

function initExpressServer() {
    expressApp = express();

    // Authentication middleware
    expressApp.use((req, res, next) => {
        const token = req.query.token || req.headers['authorization'];
        if (token !== mysettings.webhookAuthToken) {
            return res.status(401).send('Unauthorized: Invalid token');
        }
        next();
    });

    expressApp.get('/switch/:remote/:sourceIndex', (req, res) => {
        const remote = req.params.remote;
        const sourceIndex = parseInt(req.params.sourceIndex);

        if (!irdevice.remotes[remote] || !irdevice.remotes[remote].source_controls) {
            return res.status(404).send('Remote not found or has no source controls');
        }

        const sourceControl = irdevice.remotes[remote].source_controls[sourceIndex - 1];
        if (!sourceControl) {
            return res.status(404).send('Source control index not found for this remote');
        }

        // Create a mock Roon request object
        const mockReq = {
            send_complete: (status, data) => {
                console.log(`Webhook switch complete with status: ${status}`);
            }
        };

        // Call Roon's convenience_switch logic directly
        try {
            sourceControl._executeConvenienceSwitch(mockReq);
            res.send(`Switching triggered for ${remote} source ${sourceIndex}`);
        } catch (e) {
            console.error(e);
            res.status(500).send('Error triggering switch');
        }
    });

    const port = mysettings.webhookPort || 3000;
    expressServer = expressApp.listen(port, () => {
        console.log(`[IRControl Webhook] Listening on port ${port}`);
    }).on('error', (err) => {
        console.error(`[IRControl Webhook] Failed to start on port ${port}:`, err.message);
    });
}

function setup() {
	irdevice.control = IRControl;
	//initialize lirc_node
	irdevice.control.init();
	console.log(util.inspect(irdevice.remotes));
	setTimeout(() => {
	for (var lircRemote in irdevice.control.remotes) {
		console.log("[IRControl Extension] Setup: ", lircRemote);

		if (irdevice.remotes[lircRemote] && irdevice.remotes[lircRemote].source_controls) {
			irdevice.remotes[lircRemote].source_controls.forEach((source_control, index, controls) => {
				console.log(`Destroying previous source control for ${lircRemote}`);
				source_control.destroy();
				controls.splice(index, 1);
			});
		}
		if (irdevice.remotes[lircRemote] && irdevice.remotes[lircRemote].volume_control) {
			console.log(`Destroying previous volume control for ${lircRemote}`);
			irdevice.remotes[lircRemote].volume_control.destroy();
			delete (irdevice.volume_control);
		}

		if(!irdevice.remotes[lircRemote]) {
			irdevice.remotes[lircRemote] = {
			_deviceStatus: mysettings[lircRemote + "_deviceStatus"] ? mysettings[lircRemote + "_deviceStatus"] : "Standby"
		}
		} else {
			irdevice.remotes[lircRemote]._deviceStatus = mysettings[lircRemote + "_deviceStatus"] ? mysettings[lircRemote + "_deviceStatus"] : "Standby"
		}

		//TODO: will need to fix to check any remote for either volume or source control (sinlge is sufficient to consider extension configured)
		if (!mysettings[lircRemote + "_1_sourceControl"] || mysettings[lircRemote + "_1_sourceControl"] == "N") {
			svc_status.set_status("Not configured, please check settings.", true);
			ev_disconnected(lircRemote, "disconnected");
		} else {
			console.log(`Creating new remote ${lircRemote}`);
			ev_connected(lircRemote, "Standby");
		}
	}
	svc_status.set_status("Connected to IRControl", false);
    startExpressServer();
	}, 1000);

}

function setInputSequentially(lircRemote, i, currentInput, iteration) {
    let inputSelectType = mysettings[lircRemote + "_1_inputSelectType"];
    let inputSelectCommand = mysettings[lircRemote + "_1_inputSelect"];
    let inputSelectUpCommand = mysettings[lircRemote + "_1_inputSelectUp"];
    let inputSelectDownCommand = mysettings[lircRemote + "_1_inputSelectDown"];

    function sendAndWait(cmd, callback) {
        limiter.schedule(() => {
            return new Promise((resolve) => {
                irdevice.control.irsend.send_once(lircRemote, cmd, (err, stdout, stderr) => {
                    resolve();
                });
            });
        }).then(callback);
    }

    if (inputSelectType === "UpDown") {
        // Logic for two-button operation
        let targetInput = parseInt(mysettings[lircRemote + "_" + i + "_requestedInput"]);
        if (currentInput < targetInput) {
            sendAndWait(inputSelectUpCommand, () => {
                currentInput++;
                if (currentInput !== targetInput) {
                    setTimeout(() => {
                        setInputSequentially(lircRemote, i, currentInput, iteration + 1);
                    }, mysettings[lircRemote + "_1_inputChangeDelay"]);
                } else {
                    finalizeInputSelection(lircRemote, i);
                }
            });
        } else if (currentInput > targetInput) {
            sendAndWait(inputSelectDownCommand, () => {
                currentInput--;
                if (currentInput !== targetInput) {
                    setTimeout(() => {
                        setInputSequentially(lircRemote, i, currentInput, iteration + 1);
                    }, mysettings[lircRemote + "_1_inputChangeDelay"]);
                } else {
                    finalizeInputSelection(lircRemote, i);
                }
            });
        } else {
            finalizeInputSelection(lircRemote, i);
        }
    } else if (inputSelectType === "Sequential") {
        // Logic for single-button operation
        let targetInput = parseInt(mysettings[lircRemote + "_" + i + "_requestedInput"]);

        sendAndWait(inputSelectCommand, () => {
            //need to use ParseInt as all elements in the config are stored as strings
            currentInput = (parseInt(currentInput) + 1) % parseInt(mysettings[lircRemote + "_1_numInputs"]);
            console.log(`setting input to: ${currentInput}`);
            set_source(lircRemote, i, currentInput);
            if (currentInput.toString() !== mysettings[lircRemote + "_" + i + "_requestedInput"]) {
                if (iteration == 1) {
                    setTimeout(function () {
                        setInputSequentially(lircRemote, i, currentInput, iteration + 1);
                    }, mysettings[lircRemote + "_1_inputChangeDelay"]);
                } else {
                    setInputSequentially(lircRemote, i, currentInput, iteration + 1);
                }
            } else {
                if (mysettings[lircRemote + "_1_volumeResetOnInputChange"] == "Y") {
                    set_volume(lircRemote, mysettings[lircRemote + "_" + i + "_initialvolume"]);
                }
            }
        });
    } else {
        // Logic for discrete operation (no input selection needed)
        finalizeInputSelection(lircRemote, i);
    }
}

function finalizeInputSelection(lircRemote, i) {
    set_source(lircRemote, i, mysettings[lircRemote + "_" + i + "_requestedInput"]);
    if (mysettings[lircRemote + "_1_volumeResetOnInputChange"] == "Y") {
        set_volume(lircRemote, mysettings[lircRemote + "_" + i + "_initialvolume"]);
    }
}





function ev_connected(lircRemote, status) {
	let control = irdevice.control;
	let stopVolumeUpTimer = null;
	let stopVolumeDownTimer = null;

	console.log("[IRControl Extension] Connected for ", lircRemote);

	if (mysettings[lircRemote + "_volumeControl"] == "Y") {
		irdevice.remotes[lircRemote].volume_control = svc_volume_control.new_device({

				state: {
					control_key: lircRemote,
					display_name: lircRemote,
					volume_type: "incremental"
				},
				set_volume: function (req, mode, value) {

					if (mode == "relative") {
						if (value > 0) {
							if (typeof stopVolumeUpTimer == 'undefined' || stopVolumeUpTimer == null) {
								//prepare cancelation of the started IR sending if no new request comes in 300ms
								stopVolumeUpTimer = setTimeout(() => {
										irdevice.control.irsend.send_stop(lircRemote, mysettings[lircRemote + "_volumeUp"], function () {
											console.log("Stopped sending volume up command!");
											stopVolumeUpTimer = null;
										})
									}, 300);
								irdevice.control.irsend.send_start(lircRemote, mysettings[lircRemote + "_volumeUp"], function () {
									console.log("Started sending volume up command!");
								});
							} else {
								//clear current stop repeat request
								clearTimeout(stopVolumeUpTimer);
								console.log("Extending volume up repetition");
								//set new stop repeat request in another 300ms
								stopVolumeUpTimer = setTimeout(() => {
										irdevice.control.irsend.send_stop(lircRemote, mysettings[lircRemote + "_volumeUp"], function () {
											console.log("Stopped sending volume up command!");
											stopVolumeUpTimer = null;
										})
									}, 300);
							}
						} else {
							if (typeof stopVolumeDownTimer == 'undefined' || stopVolumeDownTimer == null) {
								//prepare cancelation of the started IR sending if no new request comes in 300ms
								stopVolumeDownTimer = setTimeout(() => {
										irdevice.control.irsend.send_stop(lircRemote, mysettings[lircRemote + "_volumeDown"], function () {
											console.log("Stopped sending volume down command!");
											stopVolumeDownTimer = null;
										})
									}, 300);
								irdevice.control.irsend.send_start(lircRemote, mysettings[lircRemote + "_volumeDown"], function () {
									console.log("Started sending volume down command!");
								});
							} else {
								//clear current stop repeat request
								clearTimeout(stopVolumeDownTimer);
								console.log("Extending volume down repetition");
								//set new stop repeat request in another 300ms
								stopVolumeDownTimer = setTimeout(() => {
										irdevice.control.irsend.send_stop(lircRemote, mysettings[lircRemote + "_volumeDown"], function () {
											console.log("Stopped sending volume down command!");
											stopVolumeDownTimer = null;
										})
									}, 300);
							}
						}
					}
					req.send_complete("Success");
				},
				set_mute: function (req, mode) {
					if (mode == "toggle") {
						irSendOnceWithRetry(lircRemote, mysettings[lircRemote + "_mute"]);
					}
					req.send_complete("Success");
				}
			});
	}
	let i = 1;
	irdevice.remotes[lircRemote].source_controls = [];
	while (mysettings[lircRemote + "_" + i + "_sourceControl"] == "Y") {
		create_source_control(lircRemote, i);
		i++;
	}
}

function doConvenienceSwitch(lircRemote, i, currentStatus, req) {
    if (currentStatus == "standby") {
        console.log(`Convenience switch for ${lircRemote}:${i}`);
        //in standby first wait for 'startupDelay'
        setTimeout(() => {
            //IR send 'PowerOn'
            let powerOnRetry = parseInt(mysettings[lircRemote + "_1_powerOnRetry"]) || 0;
            let powerOnRetryInterval = parseInt(mysettings[lircRemote + "_1_powerOnRetryInterval"]) || 1000;
            irSendOnceWithRetry(lircRemote, mysettings[lircRemote + "_1_powerOn"], powerOnRetry, powerOnRetryInterval);

            if (mysettings[lircRemote + "_1_inputSelectType"] === "Discrete" && mysettings[lircRemote + "_" + i + "_inputSelect"] == undefined) {
                set_source(lircRemote, i, "Selected");
            } else {
                //IR set input after startup delay
                if (mysettings[lircRemote + "_1_inputSelectType"] === "Sequential" || mysettings[lircRemote + "_1_inputSelectType"] === "UpDown") {
                    if (mysettings[lircRemote + "_currentInput"] == undefined) {
                        mysettings[lircRemote + "_currentInput"] = 0;
                    }
                    if (mysettings[lircRemote + "_currentInput"] !== mysettings[lircRemote + "_" + i + "_requestedInput"]) {
                        setTimeout(function () {
                            setInputSequentially(lircRemote, i, mysettings[lircRemote + "_currentInput"] ? mysettings[lircRemote + "_currentInput"] : 0, 1);
                        }, mysettings[lircRemote + "_1_startuptime"] * 1000);

                    } else {
                        set_source(lircRemote, i, mysettings[lircRemote + "_" + i + "_requestedInput"]);
                        setTimeout(() => {
                            set_volume(lircRemote, mysettings[lircRemote + "_" + i + "_initialvolume"]);
                        }, mysettings[lircRemote + "_1_startuptime"] * 1000);
                    }
                } else {
                    setTimeout(() => {
                        limiter.schedule(() => { irSendOnceWithRetry(lircRemote, mysettings[lircRemote + "_" + i + "_inputSelect"]) });
                        set_source(lircRemote, i, mysettings[lircRemote + "_" + i + "_inputSelect"]);

                    }, mysettings[lircRemote + "_1_startuptime"] * 1000);
                }
            }
            setTimeout(() => {
                req.send_complete("Success");
                //  set_volume(lircRemote, mysettings[lircRemote + "_" + i + "_initialvolume"]);
            }, mysettings[lircRemote + "_1_startuptime"] * 1000);
        }, mysettings[lircRemote + "_1_startupDelay"] * 1000);
    } else {
        if (mysettings[lircRemote + "_1_inputSelectType"] === "Discrete" && mysettings[lircRemote + "_" + i + "_inputSelect"] == undefined) {
  
            set_source(lircRemote, i, "Selected");
            req.send_complete("Success");
        } else {
            //IR set input when device is already on
            if (mysettings[lircRemote + "_1_inputSelectType"] === "Sequential" || mysettings[lircRemote + "_1_inputSelectType"] === "UpDown") {
                if (mysettings[lircRemote + "_currentInput"] == undefined) {
                    mysettings[lircRemote + "_currentInput"] = 0;
                }
                console.log("currentInput: " + mysettings[lircRemote + "_currentInput"]);
                if (mysettings[lircRemote + "_currentInput"] !== mysettings[lircRemote + "_" + i + "_requestedInput"]) {
  
                    setInputSequentially(lircRemote, i, mysettings[lircRemote + "_currentInput"] ? mysettings[lircRemote + "_currentInput"] : 0, 1);
                    setTimeout(() => {
                        req.send_complete("Success");
                    }, (mysettings[lircRemote + "_1_inputChangeDelay"] ? mysettings[lircRemote + "_1_inputChangeDelay"] : 1000));
                } else {
                    set_source(lircRemote, i, mysettings[lircRemote + "_" + i + "_requestedInput"]);
                    req.send_complete("Success");
                }
            } else {
                irSendOnceWithRetry(lircRemote, mysettings[lircRemote + "_" + i + "_inputSelect"]);
                set_source(lircRemote, i, mysettings[lircRemote + "_" + i + "_inputSelect"]);
                setTimeout(() => {
                    req.send_complete("Success");
                }, (mysettings[lircRemote + "_1_inputChangeDelay"] ? mysettings[lircRemote + "_1_inputChangeDelay"] : 1000));
            }
        }
    }
}

function create_source_control(lircRemote, i) {
    let deviceDefinition = {
        state: {
            control_key: lircRemote + i,
            display_name: lircRemote + (mysettings[lircRemote + "_" + i + "_requestedInputName"] ? mysettings[lircRemote + "_" + i + "_requestedInputName"] : mysettings[lircRemote + "_" + i + "_inputSelect"] ? mysettings[lircRemote + "_" + i + "_inputSelect"] : ""),
            supports_standby: true,
            status: irdevice.remotes[lircRemote]._deviceStatus == "Standby" ? "standby" :
                (mysettings[lircRemote + "_activeIndex"] === i || (!mysettings[lircRemote + "_activeIndex"] && (mysettings[lircRemote + "_deviceStatus"] == mysettings[lircRemote + "_" + i + "_inputSelect"] || mysettings[lircRemote + "_deviceStatus"] == "Selected")) ? "selected" : "deselected")
        },
        convenience_switch: function (req) {
            doConvenienceSwitch(lircRemote, i, this.state.status, req);
        },
        standby: function (req) {
            this.state.status = "standby";
            let powerOffRetry = parseInt(mysettings[lircRemote + "_1_powerOffRetry"]) || 0;
            let powerOffRetryInterval = parseInt(mysettings[lircRemote + "_1_powerOffRetryInterval"]) || 1000;
            irSendOnceWithRetry(lircRemote, mysettings[lircRemote + "_1_powerOff"], powerOffRetry, powerOffRetryInterval);
            set_source(lircRemote, i, "Standby");
            req.send_complete("Success");
        }
    };
    
    let sourceControl = svc_source_control.new_device(deviceDefinition);
    // Attach the doConvenienceSwitch directly to the object so we can call it from Express
    sourceControl._executeConvenienceSwitch = function(req) {
        let currentStatus = irdevice.remotes[lircRemote]._deviceStatus == "Standby" ? "standby" :
                (mysettings[lircRemote + "_activeIndex"] === i || (!mysettings[lircRemote + "_activeIndex"] && (mysettings[lircRemote + "_deviceStatus"] == mysettings[lircRemote + "_" + i + "_inputSelect"] || mysettings[lircRemote + "_deviceStatus"] == "Selected")) ? "selected" : "deselected");
        doConvenienceSwitch(lircRemote, i, currentStatus, req);
    };
    
    irdevice.remotes[lircRemote].source_controls.push(sourceControl);
}

function ev_disconnected(lircRemote, status) {
	console.log("[IRControl Extension] Disconnected for ", lircRemote);

	if (irdevice.remotes[lircRemote].source_controls) {
		irdevice.remotes[lircRemote].source_controls.forEach((source_control) => {
			console.log(`Destroying source control ${lircRemote}`);
			source_control.destroy();
			//delete (source_control);
		});
	}
	if (irdevice.remotes[lircRemote].volume_control) {
		irdevice.remotes[lircRemote].volume_control.destroy();
		console.log(`Destroying volume control ${lircRemote}`);
		delete (irdevice.remotes[lircRemote].volume_control);
	}
}

function set_source(lircRemote, i, val) {
    console.log(`[IRControl Extension] received source change for device [${lircRemote} ${i}]: ${val}`);
    if (val == "Standby")
        irdevice.remotes[lircRemote].source_controls.forEach((source_control) => {
            source_control.update_state({
                status: "standby"
            })
        });
    else {
        irdevice.remotes[lircRemote].source_controls.forEach((source_control, index) => {
            if (index + 1 == i) {
                source_control.update_state({
                    status: "selected"
                });
            } else {
                source_control.update_state({
                    status: "deselected"
                });
            }
        });
        mysettings[lircRemote + "_currentInput"] = val.toString();
    }
    mysettings[lircRemote + "_deviceStatus"] = val.toString();
    mysettings[lircRemote + "_activeIndex"] = i;
    roon.save_config("settings", mysettings);
}

function set_volume(lircRemote, volumeUpTime) {
	irdevice.control.irsend.send_start(lircRemote, mysettings[lircRemote + "_volumeUp"], function () {
									console.log("Started sending volume up command!");
	
	setTimeout(() => {
	irdevice.control.irsend.send_stop(lircRemote, mysettings[lircRemote + "_volumeUp"], function () {
									console.log("Stopped sending volume up command!");
									});
	}, volumeUpTime);
	});
}


function irSendOnceWithRetry(lircRemote, command, retryCount = 0, retryInterval = 1000) {
    console.log(`IR sending command for remote ${lircRemote}: ${command}, retryCount: ${retryCount}, retryInterval: ${retryInterval}`);
    
    function sendCommand(internalAttempt) {
        limiter.schedule(() => {
            return new Promise((resolve) => {
                irdevice.control.irsend.send_once(lircRemote, command, (error, stdout, stderr) => {
                    let isBusy = false;
                    if (error) {
                        console.log(`error: ${error.message}`);
                        if (error.message.includes("busy: repeating")) isBusy = true;
                    }
                    if (stderr) {
                        console.log(`stderr: ${stderr}`);
                        if (stderr.includes("busy: repeating")) isBusy = true;
                    }
                    if (stdout) {
                        console.log(`stdout: ${stdout}`);
                        if (stdout.includes("busy: repeating")) isBusy = true;
                    }

                    if (isBusy && internalAttempt < 5) {
                        console.log(`[IRControl] LIRC daemon busy: repeating. Retrying command ${command} in 300ms (attempt ${internalAttempt + 1})...`);
                        setTimeout(() => sendCommand(internalAttempt + 1), 300);
                    }
                    resolve();
                });
            });
        });
    }

    for (let i = 0; i <= retryCount; i++) {
        setTimeout(() => {
            sendCommand(0);
        }, i * retryInterval);
    }
}



setup();

roon.start_discovery();
