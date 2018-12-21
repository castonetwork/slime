const SIGURL = 'wss://demo.remotemonster.com/ws1234'
// const SIGURL = 'ws://localhost:1234'

var localVideo;
var remoteVideo;
var remoteVideo2;
var peerConnection;
var pclist=[];
var curpc;
var logcount=0;
var message = '';
var whoami = 'nobody';
var translist=[];
var runtimeStatus = 0;
var isComplete = false;
var myStream = new MediaStream();

var peerConnectionConfig = {'iceServers': [{'urls': ['stun:stun.services.mozilla.com']}, {'urls': ['stun:stun.l.google.com:19302']}], 'sdpSemantics':'unified-plan'};

navigator.getUserMedia = navigator.getUserMedia || navigator.mozGetUserMedia || navigator.webkitGetUserMedia;
window.RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
window.RTCIceCandidate = window.RTCIceCandidate || window.mozRTCIceCandidate || window.webkitRTCIceCandidate;
window.RTCSessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription || window.webkitRTCSessionDescription;

function pageReadyForRelayServer() {
    l('pageReadyForRelayServer is called');
    whoami = 'relay';
    serverConnection = new WebSocket(SIGURL);
    serverConnection.onmessage = gotMessageFromServer;
    var constraints = { video: true, audio:true};
    m('RelayServer is ready!');
}

function pageReady() {
    localVideo = document.getElementById('localVideo');
    remoteVideo = document.getElementById('remoteVideo');
    remoteVideo2 = document.getElementById('remoteVideo2');

    serverConnection = new WebSocket(SIGURL);
    serverConnection.onmessage = gotMessageFromServer;

    var constraints = {
        video: true,
        audio: true,
    };
    navigator.mediaDevices.getUserMedia(constraints)
        .then(getUserMediaSuccess)
        .catch(rtcError);
}

function getUserMediaSuccess(stream) {
    l("getUserMediaSuccess");
    localStream = stream;
    localVideo.srcObject = stream;
}

function startRelay() {
    peerConnection = new RTCPeerConnection(peerConnectionConfig);
    peerConnection.onicecandidate = gotIceCandidate;
    peerConnection.ontrack = gotRemoteStream;
    peerConnection.oniceconnectionstatechange = gotCommonIceEvents;
    m('PeerConnection for sender is ready');
}
function startViewer(isCaller) {
    whoami = 'view';
    peerConnection = new RTCPeerConnection(peerConnectionConfig);
    peerConnection.onicecandidate = gotIceCandidate;
    peerConnection.ontrack = gotRemoteStream;
    peerConnection.addStream(localStream);
    peerConnection.getTransceivers()[0].direction='recvonly';
    peerConnection.getTransceivers()[1].direction='recvonly';
    peerConnection.oniceconnectionstatechange = gotCommonIceEvents;

    l('Viewer: createoffer for receive');
    peerConnection.createOffer({offerToReceiveAudio:true, offerToReceiveVideo:true}).then(gotDescription).catch(rtcError);

}
function startCast(isCaller) {
    whoami = 'cast';
    peerConnection = new RTCPeerConnection(peerConnectionConfig);
    peerConnection.onicecandidate = gotIceCandidate;
    peerConnection.ontrack = gotRemoteStream;
    peerConnection.addStream(localStream);
    peerConnection.getTransceivers()[0].direction='sendonly';
    peerConnection.getTransceivers()[1].direction='sendonly';
    peerConnection.oniceconnectionstatechange = gotCommonIceEvents;

    l("Caster: createOffer");
    peerConnection.createOffer({offerToReceiveAudio:false, offerToReceiveVideo:false}).then(gotDescription).catch(rtcError);
}

function gotCommonIceEvents(event){
    l('peerconnection ice state: '+ peerConnection.iceConnectionState);
    if (peerConnection.iceConnectionState === 'connected'){
        if (whoami === 'relay'){
            translist = peerConnection.getTransceivers();
            runtimeStatus = 0;
        }
    }
}

function gotRelayIceEvents(event) {
    if (curpc){
        l('PC for viewer event: '+ curpc.iceConnectionState);
        if (curpc.iceConnectionState === 'connected') {
            pclist.push(curpc);
            curpc = null;
            runtimeStatus = 0;
            m('number of viewer: ' + pclist.length);
        }
    }
}

function gotDescriptionForViewer(description) {
    l('got local description for viewers');
    var that = this;
    curpc.setLocalDescription(description, function() {
            that.serverConnection.send(JSON.stringify({'sdp': description}));
            }, rtcError);
}

function gotDescription(description) {
    l('got local description');
    var that = this;
    peerConnection.setLocalDescription(description, function () {
        l('send local sdp to server');
        that.serverConnection.send(JSON.stringify({'sdp': description}));
    }, rtcError);
}

function gotIceCandidate(event) {
    var that = this;
    l('got local IceCandidate and send it to server');
    if(event.candidate != null) {
        serverConnection.send(JSON.stringify({'ice': event.candidate}));
    }
}

function gotRemoteStreamFromThirdPeer(event) {
    if (whoami === 'relay'){
        l('got remoteStream from thrid to seeder');
    }
}

function gotRemoteStream(event) {
    l("got remote track. type:");
    if (event.streams.length>0){
        if (remoteVideo && whoami !=='relay')
            remoteVideo.srcObject = event.streams[0];
    }else{
        if (event.type === 'track'){
            myStream.addTrack(event.track);
            if (myStream.getTracks().length==2){
                remoteVideo.srcObject = myStream;
            }
        }
    }
    isComplete=true;
}

function gotMessageFromServer(message) {
    var caller=true;
    const signal = JSON.parse(message.data);
    if (isComplete===true && (whoami === 'cast' || whoami === 'view')) return;
    if(!peerConnection){
        startRelay();
        caller=false;
        if (whoami !=='cast' && whoami !=='view') {
            runtimeStatus = 1;
            whoami = 'relay';
        }
    }
    
    // 2번째 caller가 나타났을 때 seeder의 반응은?
    if (peerConnection && whoami === 'relay' && runtimeStatus==0){
        runtimeStatus = 1;
        if (!curpc){
            l('relay에서 viewer와의 통신 위한 pc가 널이어서 생성');
            curpc= new RTCPeerConnection(peerConnectionConfig);
            curpc.onicecandidate = gotIceCandidate;
            curpc.oniceconnectionstatechange = gotRelayIceEvents;
            curpc.ontrack = gotRemoteStreamFromThirdPeer;
            curpc.addTrack(translist[0].receiver.track);
            curpc.addTrack(translist[1].receiver.track);
        }
    }
    if (runtimeStatus == 1 && curpc && whoami === 'relay'){
        l('relay에서 viewer와의 통신 위한 message처리');
        var thatpc = curpc;
        if (signal.sdp){
            l('got message from sig server: signal.sdp');
            curpc.setRemoteDescription(new RTCSessionDescription(signal.sdp))
                .then( function() {
                        l('createAnswer for viewer');
                        thatpc.createAnswer().then(gotDescriptionForViewer).catch(rtcError);
                        }).catch(rtcError);
        }else if (signal.ice){
            l('got message from sig server: signal.ice');
            thatpc.addIceCandidate(new RTCIceCandidate(signal.ice));
        }
        return;
    }
    if(signal.sdp) {
        l('got Message From Server: signal.sdp' );
        if(caller) peerConnection.setRemoteDescription(
            new RTCSessionDescription(signal.sdp), function(){},rtcError);
        else{
            peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp))
                .then( function() {
                    l("Callee: CreateAnswer");
                    peerConnection.createAnswer().then(gotDescription).catch( rtcError);
                })
                .catch( rtcError);
        }
    } else if(signal.ice) {
        l('got message from server: signal.ice' + signal.ice.candidate);
        peerConnection.addIceCandidate(new RTCIceCandidate(signal.ice));
    }
}

function l(msg){
    console.log("log "+ logcount++ +":"+ msg);
}

function m(msg){
    message= msg+ '<br>' + message;
    var el = document.getElementById('log');
    el.textContent = message;
}

function rtcError(error) {
    console.error(error);
}