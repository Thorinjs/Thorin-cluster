'use strict';
const cluster = require('cluster'),
  EventEmitter = require('events').EventEmitter,
  os = require('os');
/**
 * The thorin.js cluster module offers support for cluster and worker wrapping.
 * This is just a small wrapper over the native cluster module and offers a few
 * SIGINT handlings.
 * */
const config = {
  maxWorkers: os.cpus().length,
  restart: true     // should we restart a worker
};
let masterFn = null,
  workerFn = null;

class ThorinCluster extends EventEmitter {

  constructor() {
    super(arguments);
    this.isMaster = cluster.isMaster;
    this.isWorker = !this.isMaster;
    this.cpus = config.maxWorkers;
  }

  /**
   * Sets the maximum number of workers.
   * */
  max(nr) {
    config.maxWorkers = nr;
    return this;
  }

  /**
   * This callback is called when we're a master.
   * */
  master(fn) {
    if (typeof fn === 'function') {
      masterFn = fn;
    }
    return this;
  }

  /**
   * The callback is called when we're a worker inside the cluster.
   * */
  run(fn) {
    if (typeof fn === 'function') {
      workerFn = fn;
    }
    return this;
  }
}

const clusterObj = new ThorinCluster();
module.exports = clusterObj;

function startMaster() {
  masterFn();
  const WORKERS = {};
  for(let i=0; i < config.maxWorkers; i++) {
    cluster.fork();
  }
  cluster.on('fork', (worker) => {
    WORKERS[worker.id] = worker;
    clusterObj.emit('fork', worker);
  });
  // handle exits
  cluster.on('exit', (worker, code) => {
    delete WORKERS[worker.id];
    // restart
    if(config.restart) {
      clusterObj.emit('exit', worker);
      cluster.fork();
    }
  });
}

function startWorker() {
  /* We're workers */
  clusterObj.worker = cluster.worker;
  if(typeof workerFn !== 'function') {
    console.error(`No run() function registered for cluster workers.`);
    return;
  }
  workerFn(clusterObj.worker);
}

/*
 * Start up the cluster
 * */
setTimeout(() => {
  if (clusterObj.isMaster) {
    return startMaster();
  }
  startWorker();
}, 1);
