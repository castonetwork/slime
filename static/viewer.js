import {
  l,
  pcConfig,
  serverConnection,
  gotDescription,
  gotIceCandidate,
  constraints
} from "./common.js";
let pc;
let localVideo, remoteVideo;
let localStream;
let isComplete = false;

async function pageReady() {
  l("pageReady is called");
  localVideo = document.getElementById("localVideo");
  remoteVideo = document.getElementById("remoteVideo");

  serverConnection.onmessage = gotMessageFromServer;

  localStream = await navigator.mediaDevices.getUserMedia(constraints);
  localVideo.srcObject = localStream;

  document.getElementById("start").onclick = startViewer;
}

let myStream = new MediaStream();
function gotRemoteStream(event) {
  l("got remote track. type:");
  if (event.type === "track") {
    myStream.addTrack(event.track);
    if (myStream.getTracks().length === 2) {
      remoteVideo.srcObject = myStream;
    }
  }
  isComplete = true;
}

function gotCommonIceEvents(event) {}

async function startViewer(isCaller) {
  pc = new RTCPeerConnection(pcConfig);
  pc.onicecandidate = gotIceCandidate;
  pc.ontrack = gotRemoteStream;
  pc.addStream(localStream);
  Array.from(pc.getTransceivers()).forEach(o => (o.direction = "recvonly"));
  pc.oniceconnectionstatechange = gotCommonIceEvents;

  l("Caster: createOffer");
  const desc = await pc.createOffer({
    offerToReceiveAudio: true,
    offerToReceiveVideo: true
  });
  await gotDescription(pc, desc);
}

async function gotMessageFromServer(message) {
  const signal = JSON.parse(message.data);
  if (isComplete) return;

  l(`sender에서 relay와의 통신 위한 message처리`);
  if (signal.sdp) {
    await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
  } else if (signal.ice) {
    l("got message from sig server: signal.ice");
    pc.addIceCandidate(new RTCIceCandidate(signal.ice));
  }
}

pageReady();
