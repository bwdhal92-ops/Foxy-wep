window.processApprovedJoin = function(n) {
  const e = pendingApprovals[n];
  if (e) {
    e.conn.send({
      type: "intro-ack"
    }), connections[n].name = e.name, connections[n].established = !0, connections[n].approved = !0, addParticipantUI(n, e.name, n === currentHostId), addSystemMsg(window.__f("js.approved_join", {name: e.name}, `${e.name} انضم بعد موافقتك`));
    const o = Object.keys(connections).filter(e => e !== n);
    e.conn.send({
      type: "sync",
      peers: o,
      hostId: currentHostId,
      roomMode: roomMode
    });
    const c = peer.call(n, localStream);
    handleCall(c), delete pendingApprovals[n]
  }
}, window.processRejectedJoin = function(n) {
  const e = pendingApprovals[n];
  e && (e.conn.send({
    type: "rejected"
  }), setTimeout(() => {
    connections[n] && (connections[n].conn.close(), delete connections[n]), delete pendingApprovals[n]
  }, 500), addSystemMsg(window.__f("js.reject_join", {name: e.name}, `تم رفض طلب انضمام ${e.name}`)))
};