"use strict";

var IRControl            = require('lirc_node'),
    RoonApi              = require("node-roon-api"),
    RoonApiSettings      = require('node-roon-api-settings'),
    RoonApiStatus        = require('node-roon-api-status'),
    RoonApiSourceControl = require('node-roon-api-source-control');

var roon = new RoonApi({
    extension_id:        'com.stefan747.roon.IRControl',
    display_name:        'IR Source Control',
    display_version:     "1.0.0",
    publisher:           'Stefan Kruzlik',
    email:               'stefan.kruzlik@gmail.com',
    website:             'https://github.com/stefan747/roon-extension-IRControl'
});

var mysettings = roon.load_config("settings") || {
    remoteName:    "",
    remoteCommand:     "Power",
    startuptime: 15
};

var irdevice = { };

function makelayout(settings) {
    var l = {
        values:    settings,
    layout:    [],
    has_error: false
    };

    //name of the remote from the LIRC setup (on linux: /etc/lirc/lircd.conf
        l.layout.push({
            type:      "string",
            title:     "LIRC RemoteControl Name",
            maxlength: 256,
            setting:   "remoteName",
        });
    //name of the remote command from the LIRC setup
    l.layout.push({
        type:    "string",
        title:   "LIRC RemoteControl Command",
        maxlength: 256,
        setting: "remoteCommand",
    });
    //time it takes for the devices powered on by IR to be ready to play music from Roon
    l.layout.push({
        type:    "integer",
        title:   "Device Startup Time (s)",
        min:     0,
        max:     100,
        setting: "startuptime",
    });
    return l;
}

var svc_settings = new RoonApiSettings(roon, {
    get_settings: function(cb) {
        cb(makelayout(mysettings));
    },
    save_settings: function(req, isdryrun, settings) {
    let l = makelayout(settings.values);
        req.send_complete(l.has_error ? "NotValid" : "Success", { settings: l });

        if (!isdryrun && !l.has_error) {
            var oldremotecommand = mysettings.remoteCommand;
            var oldremotename = mysettings.remoteName;
            mysettings = l.values;
            svc_settings.update_settings(l);
            let force = false;
            if (oldremotename != mysettings.remoteName) force = true;
            if (force) setup();
            roon.save_config("settings", mysettings);
        }
    }
});

var svc_status = new RoonApiStatus(roon);
var svc_source_control = new RoonApiSourceControl(roon);

roon.init_services({
    provided_services: [ svc_source_control, svc_settings, svc_status ]
});

function setup() {
    console.log("[IRControl Extension] Setup: ", mysettings.remoteName);
    irdevice.source = "Standby";
    irdevice.control = IRControl;
    //initialize lirc_node
    irdevice.control.init();

    if (irdevice.source_control) { irdevice.source_control.destroy(); delete(irdevice.source_control); }

    var opts = { source: mysettings.remoteCommand };
    if (!mysettings.remoteName || mysettings.remoteName == "") {
        svc_status.set_status("Not configured, please check settings.", true);
        ev_disconnected("disconnected");
        return;
    }
    opts.remoteName = mysettings.remoteName;
    console.log(opts);
    ev_connected("Selected");
}

function ev_connected(status) {
    let control = irdevice.control;

    console.log("[IRControl Extension] Connected");

    svc_status.set_status("Connected to IRControl", false);

    irdevice.source_control = svc_source_control.new_device({
    state: {
        display_name:     mysettings.remoteName,
        supports_standby: true,
        status:           irdevice.source == "Standby" ? "standby" : "selected" 
    },
    convenience_switch: function (req) {
        if(this.state.status == "standby") {
            irdevice.control.irsend.send_once(mysettings.remoteName, mysettings.remoteCommand, function() {
                console.log("Sent power on command!");
            });
            ev_source("Selected");
            setTimeout(() => {
                req.send_complete("Success");
            }, mysettings.startuptime * 1000);
        }
        else {
            ev_source("Power");
            req.send_complete("Success");
        }
    },
    standby: function (req) {
        this.state.status = "standby";
            irdevice.control.irsend.send_once(mysettings.remoteName, mysettings.remoteCommand, function() {
                console.log("Sent power off command!");
            });
            ev_source("Standby");
        req.send_complete("Success");
    }
    });

}

function ev_disconnected(status) {
    console.log("[IRControl Extension] Disconnected");

    if (irdevice.source_control) { irdevice.source_control.destroy(); delete(irdevice.source_control); }
}

function ev_source(val) {
    console.log("[IRControl Extension] received source change from device:", val);
    if (val == "Standby" && irdevice.source_control)
        irdevice.source_control.update_state({ status: "standby" });
    else {
    irdevice.source_control.update_state({ status: "selected" });
    }
}

setup();

roon.start_discovery();
