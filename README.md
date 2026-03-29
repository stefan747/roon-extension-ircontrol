# [Roon](https://roonlabs.com) Extension for Advanced IR Control

A [node-roon-api](https://github.com/RoonLabs/node-roon-api) extension providing advanced [volume and source control](https://github.com/RoonLabs/node-roon-api-source-control) functionality for external audio devices (Preamps, DACs, AVRs) via Infrared Protocol using [lirc_node](https://github.com/alexbain/lirc_node).

---------------------

## What's New in v2.0.0

The extension has been significantly upgraded from simple power control to a full-featured, multi-zone IR command center:

- **Multiple Configs per Device:** Support for configuring multiple input sources and volume controls for a single device (e.g., Preamp or DAC).
- **Multi-Zone Auto-Switching:** Assign different input configs to different Roon zones. When you switch playback between zones, Roon will automatically switch your Preamp to the correct input.
- **Webhook Integration:** A built-in Express server automatically generates unique Webhook URLs for every configured input. This allows you to switch inputs externally (e.g., via the [RooMax](https://community.roonlabs.com/t/roomax-best-wireless-roon-remote-ever/279160) extension or Smart Home systems) *without* needing Roon to start playing music first.
- **Robust State Tracking:** The extension now reliably remembers exactly which input was active even after a reboot or crash.


## Prerequisites

- [Lirc](http://www.lirc.org/) on Linux (not tested, but possibly WinLirc could work).
- Lirc setup with the remote config for your device in `/etc/lirc/lircd.conf`.
- USB IR Transceiver adapter (like the [Irdroid Transceiver](https://irdroid.eu/product/usb-infrared-transceiver/)) with an IR Emitter extension cable.
  - *Note: If using Irdroid for Linux, you may need their patched version of the Lirc library.*

## Setup Parameters (Configured via Roon)

The Roon Settings UI dynamically builds based on your LIRC configuration. You can configure:

- **Global Webhook Settings:** Set your custom Express server port (default `3000`). Auth tokens are automatically generated.
- **Volume Control:** Map IR commands to Volume Up, Volume Down, and Mute.
- **Source Controls (Inputs):** Configure multiple inputs per remote. For each source, you can define:
  - **Power On/Off Commands** (with configurable retries and delays).
  - **Input Select Type:** Choose between Discrete, Sequential, or Up/Down input switching.
  - **Delays & Timing:** Configurable startup times, input change delays, and initial volume "button hold" durations.
  - **Webhook URLs:** Each source automatically displays its own dedicated Webhook URL right in the Roon UI. Simply copy and paste it into your external controller!

---------------------

## Example Scenarios & Usage

### Scenario 1: Roon Multi-Zone Switching
You have a Preamp and a DAC connected to multiple Roon endpoints. You can create multiple Source Controls in the extension (e.g., "Optical" and "HDMI"). Assign the "Optical" config to Roon Zone 1, and the "HDMI" config to Roon Zone 2. 
When you hit Play on Zone 2, Roon automatically tells the extension to wake the Preamp and fire the sequence of IR commands to switch to the HDMI input.

### Scenario 2: External Switching via Webhooks
Roon strictly requires an active audio stream to trigger an input switch. If you want to switch your Preamp to a non-Roon input (like your TV) without playing music, you can use the built-in Webhooks.
1. Go to the extension settings in Roon and copy the automatically generated Webhook URL for your "TV" Source Control.
2. Paste this URL into a macro in your external controller (like the [RooMax](https://community.roonlabs.com/t/roomax-best-wireless-roon-remote-ever/279160) extension).
3. Triggering the macro instantly switches the Preamp to the TV input and seamlessly updates the active/inactive state in Roon so your zones stay in sync.

### Shutting Down whole Zone
When using one of the availabe Roon extensions that provide zone control to shut down a zone that shares devices (like your Preamp and DAC), Roon will only send a Standby command to devices that are *actively selected* in that zone (They appear with blue power button in the Roon UI). If you switched your Preamp to the TV (making it inactive in Roon, which shows the power button in white color), Roon will ignore it during shutdown and instead bring it into the zone to activate it.

**To cleanly shut down all devices in the zone:**
1. Start music playback briefly in the zone you want to shutdown. This pulls all devices back to the active zone.
2. Initiate zone shutodown. Roon will now successfully send the Standby command to all your devices.
