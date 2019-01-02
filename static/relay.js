import {
  l,
  m,
  rtcError,
  pcConfig,
  serverConnection,
  gotIceCandidate
} from "./common.js";
var pclist = [];
var translist = [];

const pageReadyForRelayServer = () => {
  l("pageReadyForRelayServer is called");
  serverConnection.onmessage = gotMessageFromServer;
  m("RelayServer is ready!");
};
pageReadyForRelayServer();

function gotRemoteStreamFromThirdPeer(event) {
  l("got remoteStream from thrid to seeder");
}

async function gotDescription(peer, description) {
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

function gotRemoteStream(event) {
  l("got remote track. type:" + event.type + ":" + event.streams.length);
}

let curpc, pc;
let runtimeStatus = 0;

async function relayViewerMessaging(signal, pc) {
  if (signal.sdp) {
    await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
    const desc = await pc.createAnswer();
    await gotDescription(pc, desc);
  } else if (signal.ice) {
    l("got message from sig server: signal.ice");
    pc.addIceCandidate(new RTCIceCandidate(signal.ice));
  }
}

async function gotMessageFromServer(message) {
  function gotCommonIceEvents(event) {
    l("pc ice state: " + pc.iceConnectionState);
    if (pc.iceConnectionState === "connected") {
      translist = pc.getTransceivers();
      runtimeStatus = 0;
    }
  }

  function gotRelayIceEvents(event) {
    if (curpc) {
      l("PC for viewer event: " + curpc.iceConnectionState);
      if (curpc.iceConnectionState === "connected") {
        pclist.push(curpc);
        curpc = null;
        runtimeStatus = 0;
        m("number of viewer: " + pclist.length);
      }
    }
  }

  var caller = true;
  const signal = JSON.parse(message.data);
  if (!pc) {
    function startRelay() {
      pc = new RTCPeerConnection(pcConfig);
      pc.onicecandidate = gotIceCandidate;
      pc.ontrack = gotRemoteStream;
      pc.oniceconnectionstatechange = gotCommonIceEvents;
      m("pc for sender is ready");
    }
    startRelay();
    caller = false;
    runtimeStatus = 1;
  }
  // 2번째 caller가 나타났을 때 seeder의 반응은?
  if (pc && runtimeStatus === 0) {
    runtimeStatus = 1;
    if (!curpc) {
      l("relay에서 viewer와의 통신 위한 pc가 널이어서 생성");
      curpc = new RTCPeerConnection(pcConfig);
      curpc.onicecandidate = gotIceCandidate;
      curpc.oniceconnectionstatechange = gotRelayIceEvents;
      curpc.ontrack = gotRemoteStreamFromThirdPeer;

      translist.forEach(trans => curpc.addTrack(trans.receiver.track));
    }
  }
  l(`relay에서 viewer와의 통신 위한 message처리: ${runtimeStatus}`);

  relayViewerMessaging(signal, (runtimeStatus === 1 && curpc && curpc) || pc);
}
