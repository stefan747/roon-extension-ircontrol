# [Roon](https://roonlabs.com) [Extension](node-roon-api) to provide [standby](https://github.com/RoonLabs/node-roon-api-source-control) functionality for devices via Infrared Protocol using [lirc_node](https://github.com/alexbain/lirc_node).

This extension allows power control of your audio device (DAC, Preamplifier, Integrated Amplifier, etc) using infrared control command via the Roon interface.
---------------------

This extension was tested with Chord Electronics Dave which does not offer any other way of control than IR.

## Prerequisites

- [Lirc](http://www.lirc.org/) on Linux (not tested, but possibly also WinLirc could work) 
- Lirc setup with the remote config for the remote control of your device in /etc/lirc/lircd.conf (or whereever you choose to keep the config)
- USB IR Trasciever adapter like the [Irdroid Trasciever](https://irdroid.eu/product/usb-infrared-transceiver/) with [Emitter extension cable](https://irdroid.eu/product/infrared-emitter-extension-cable-1-5-meters/)
	- if using Irdroid for Linux, you'll need to download and compile their patched verson of [Lirc library](https://www.irdroid.com/downloads/?did=16)
---------------------

This is my personal setup, but any Linux based device can be setup the same way:

    SOtM SMS-200Ultra
	-> USB audio -> USB cable -> Chord Dave DAC
	-> USB IR Trasciever -> IR extension cable

## Setup parameters (configured via Roon):
- Lirc RemoteControl Name: Name of the Lirc remote setup in /etc/lirc/lircd.conf
- Lirc RemoteControl Command: Name of the Lirc remote command setup in /etc/lirc/lircd.conf for powering the device on and off
- Startup Time: Time in seconds it takes to wake up the device controlled by IR before any stream is started
