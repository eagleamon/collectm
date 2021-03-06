
var process = require('process');
process.env.ALLOW_CONFIG_MUTATIONS = 1;

var os = require('os');
var Collectd = require('collectdout');
var cfg = require('config');
var collectmHTTPConfig = require('./httpconfig.js');

var collectmVersion = '<%= pkg.version %>';

var counters = [];
var client;
var path = require('path').dirname(require.main.filename);

var plugin = {};
var pluginsCfg = [];

// Initialize configuration directory in the same way that node-config does.
var configDir = cfg.util.initParam('NODE_CONFIG_DIR', process.cwd() + '/config');
if (configDir.indexOf('.') === 0) {
    configDir = process.cwd() + '/' + CONFIG_DIR;
}

var each = function(obj, block) {
  var attr;
  for(attr in obj) {
    if(obj.hasOwnProperty(attr))
      block(attr, obj[attr]);
  }
};

function get_hostname_with_case() {
    var h = cfg.has('Hostname') ? cfg.get('Hostname') : os.hostname();
    var hcase = cfg.has('HostnameCase') ? cfg.get('HostnameCase') : 'default';
    switch(hcase) {
        case 'upper': h = h.toUpperCase(); break;
        case 'lower': h = h.toLowerCase(); break;
    }
    return(h);
}

function get_collectd_servers_and_ports() {
    var servers = cfg.has('Network.servers') ? cfg.get('Network.servers') : {};
    var res = [];
    for (var i in servers) {
        res.push( [ servers[i].hostname, (servers[i].port || 25826) ] );
    }
    return(res);
}

function get_interval() {
    return(cfg.has('Interval') ? (cfg.get('Interval') * 1000) : 60000);
}

client = new Collectd(get_interval(), get_collectd_servers_and_ports(), 0, get_hostname_with_case());

/* Load the plugins */
pluginsCfg = cfg.has('Plugin') ? cfg.get('Plugin') : [];
plugin = {};
each(pluginsCfg, function(p) {
    var enabled;
    try {
        enabled = cfg.has('Plugin.'+p+'.enable') ? cfg.get('Plugin.'+p+'.enable') : 1;
        if(enabled) {
            plugin[p] = require('./plugins/'+p+'.js');
        }
    } catch(e) {
        console.log('Failed to load plugin '+p+' ('+e+')\n');
    }
});

/* Initialize the plugins */
each(plugin, function(p) {
    try {
        plugin[p].reInit();
    } catch(e) {
        console.log('Failed to reInit plugin '+p+' ('+e+')\n');
    }
});

/* Configure the plugins */
each(plugin, function(p) {
    try {
        plugin[p].reloadConfig({
            config: cfg.get('Plugin.'+p),
            client: client,
            counters: counters,
        });
    } catch(e) {
        console.log('Failed to reloadConfig plugin '+p+' ('+e+')\n');
    }
});

/* Start the plugins */
each(plugin, function(p) {
    try {
        plugin[p].monitor();
    } catch(e) {
        console.log('Failed to start plugin '+p+' monitor ('+e+')\n');
    }
});

/* Load the httpconfig User Interface */
if(cfg.get('HttpConfig.enable')) {
    collectmHTTPConfig.init({
            cfg: cfg,
            path: path,
            configDir: configDir,
            collectmVersion: collectmVersion,
            plugins: plugin,
            });
    collectmHTTPConfig.start();
}


// vim: set filetype=javascript fdm=marker sw=4 ts=4 et:
