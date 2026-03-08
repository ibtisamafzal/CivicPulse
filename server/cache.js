const snapshotCache = new Map();
const ticketCache = [];

let latestDate = null;

function setSnapshot(date, snapshot) {
  snapshotCache.set(date, snapshot);
  latestDate = date;
}

function getSnapshot(date) {
  return snapshotCache.get(date) || null;
}

function getLatestSnapshot() {
  if (latestDate && snapshotCache.has(latestDate)) {
    return { date: latestDate, snapshot: snapshotCache.get(latestDate) };
  }

  const dates = Array.from(snapshotCache.keys()).sort();
  if (dates.length === 0) {
    return null;
  }

  const date = dates[dates.length - 1];
  latestDate = date;
  return { date, snapshot: snapshotCache.get(date) };
}

function pushTicket(ticket) {
  ticketCache.unshift(ticket);
  if (ticketCache.length > 200) {
    ticketCache.pop();
  }
}

function listTickets(limit = 50) {
  return ticketCache.slice(0, limit);
}

module.exports = {
  setSnapshot,
  getSnapshot,
  getLatestSnapshot,
  pushTicket,
  listTickets,
};
