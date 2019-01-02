var logcount = 0;
var message = "";
const SIGURL = "wss://demo.remotemonster.com/ws1234";

export const serverConnection = new WebSocket(SIGURL);
export const constraints = {
  video: true,
  audio: true
};

export function l(msg) {
  const stack = new Error().stack;
  const info =
    stack.split("at ")[2].match(/(.*) \(.*:([0-9]+:[0-9]+)\)/) ||
    stack.split("at ")[2].match(/().*:([0-9]+:[0-9]+)/);
  console.log(`${Date.now()},${info[1]},${info[2]},log ${logcount++}:${msg}`);
}

export function m(msg) {
  message = msg + "<br>" + message;
  var el = document.getElementById("log");
  el.textContent = message;
}

export function rtcError(error) {
  console.error(error);
}

export const pcConfig = {
  iceServers: [
    { urls: ["stun:stun.services.mozilla.com"] },
    { urls: ["stun:stun.l.google.com:19302"] }
  ],
  sdpSemantics: "unified-plan"
};

export async function gotDescription(peer, description) {
  l("got local description for viewers");
  try {
    await peer.setLocalDescription(description);
  } catch (e) {
    rtcError(e);
  } finally {
    l("send sdp to server");
    serverConnection.send(JSON.stringify({ sdp: description }));
  }
}

export function gotIceCandidate(event) {
  l("got local IceCandidate and send it to server");
  if (event.candidate != null) {
    serverConnection.send(JSON.stringify({ ice: event.candidate }));
  }
}

navigator.getUserMedia =
  navigator.getUserMedia ||
  navigator.mozGetUserMedia ||
  navigator.webkitGetUserMedia;
window.RTCPeerConnection =
  window.RTCPeerConnection ||
  window.mozRTCPeerConnection ||
  window.webkitRTCPeerConnection;
window.RTCIceCandidate =
  window.RTCIceCandidate ||
  window.mozRTCIceCandidate ||
  window.webkitRTCIceCandidate;
window.RTCSessionDescription =
  window.RTCSessionDescription ||
  window.mozRTCSessionDescription ||
  window.webkitRTCSessionDescription;
