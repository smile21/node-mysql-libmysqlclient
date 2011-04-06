#!/usr/bin/env node
/*
Copyright by Oleg Efimov and node-mysql-libmysqlclient contributors
See contributors list in README

See license text in LICENSE file
*/

var
// Require modules
  sys = require("sys"),
  stdin,
  stdout,
  readline = require('readline'),
  rli,
  node_gc,
  gc,
  mysql_libmysqlclient = require("../mysql-libmysqlclient"),
  mysql_bindings = require("../mysql_bindings"),
  cfg = require("../tests/config"),
  connGlobal = mysql_libmysqlclient.createConnectionSync(cfg.host, cfg.user, cfg.password, cfg.database),
// Params
  prompt = "mlf> ",
  commands,
// Initial memory usage
  initial_mu;

function show_memory_usage_line(title, value0, value1) {
  if (value1) {
    stdout.write(title + ": " + value1 + (value1 > value0 ? " (+" : " (") + (100 * (value1 - value0) / value0).toFixed(2) + "%)\n");
  } else {
    sys.puts(title + ": " + value0 + "\n");
  }
}

function show_memory_usage() {
  if (!initial_mu) {
    initial_mu = process.memoryUsage();
    
    sys.puts("Initial memory usage:");
    sys.puts("rss: " + initial_mu.rss);
    sys.puts("vsize: " + initial_mu.vsize);
    sys.puts("heapUsed: " + initial_mu.heapUsed);
  } else {
    var mu = process.memoryUsage();
    
    stdout.write("Currect memory usage:\n");
    show_memory_usage_line("rss", initial_mu.rss, mu.rss);
    show_memory_usage_line("vsize", initial_mu.vsize, mu.vsize);
    show_memory_usage_line("heapUsed", initial_mu.heapUsed, mu.heapUsed);
  }
}

commands = {
  quit: function () {
    process.exit(0);
  },
  show_memory_usage: function () {
    show_memory_usage();
  },
  gc: function () {
    gc.collect();
  },
  help: function () {
    var cmd;
    stdout.write("List of commands:\n");
    for (cmd in commands) {
      if (commands.hasOwnProperty(cmd)) {
        stdout.write(cmd + "\n");
      }
    }
  },
  new_connection: function () {
    var conn = new mysql_bindings.MysqlConnection();
  },
  error_in_connect: function () {
    var
      conn = mysql_libmysqlclient.createConnectionSync(cfg.host, cfg.user, cfg.password, cfg.database_denied),
      error = conn.connectionError;
  },
  error_in_query: function () {
    var
      conn = mysql_libmysqlclient.createConnectionSync(cfg.host, cfg.user, cfg.password),
      error;
    
    conn.querySync("USE " + cfg.database_denied + ";");
    error = conn.errorSync();
    
    conn.closeSync();
  },
  fetch_all: function () {
    var
      conn = mysql_libmysqlclient.createConnectionSync(cfg.host, cfg.user, cfg.password, cfg.database),
      res,
      rows;
    
    res = conn.querySync("SELECT 'some string' as str;");
    rows = res.fetchAllSync();
    
    conn.closeSync();
  },
  fetch_all_and_free: function () {
    var
      conn = mysql_libmysqlclient.createConnectionSync(cfg.host, cfg.user, cfg.password, cfg.database),
      res,
      rows;
    
    res = conn.querySync("SELECT 'some string' as str;");
    rows = res.fetchAllSync();
    
    res.freeSync();
    conn.closeSync();
  },
  fetch_lowlevel: function () {
    var
      conn = mysql_libmysqlclient.createConnectionSync(cfg.host, cfg.user, cfg.password, cfg.database),
      res,
      row;
    
    conn.realQuerySync("SHOW TABLES;");
    res = conn.storeResultSync();
    
    while ((row = res.fetchArraySync())) {
      // Empty block
    }
    
    conn.closeSync();
  },
  fetch_lowlevel_and_free: function () {
    var
      conn = mysql_libmysqlclient.createConnectionSync(cfg.host, cfg.user, cfg.password, cfg.database),
      res,
      row;
    
    conn.realQuerySync("SHOW TABLES;");
    res = conn.storeResultSync();
    
    while ((row = res.fetchArraySync())) {
      // Empty block
    }
    
    res.freeSync();
    conn.closeSync();
  },
  without_callback: function () {
    /***
    CREATE TABLE IF NOT EXISTS `stats` (
      `timestamp` int(11) NOT NULL,
      `ip` int(10) unsigned NOT NULL,
      `url` varchar(255) COLLATE utf8_unicode_ci NOT NULL
    ) ENGINE=MyISAM DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
    ***/
    
    try {
      connGlobal.query("INSERT INTO stats(timestamp, ip, url) VALUES (UNIX_TIMESTAMP(), INET_ATON('127.0.0.1'), 'https://github.com/Sannis/node-mysql-libmysqlclient/');");
    } catch (e) {
      //stdout.write(e);
    }
  },
  escape: function () {
    var
      conn = mysql_libmysqlclient.createConnectionSync(cfg.host, cfg.user, cfg.password, cfg.database),
      str;
    
    str = conn.escapeSync("some string");
    
    conn.closeSync();
  }
};

// Main program

try {
  node_gc = require("gc");
  gc = new node_gc.GC();
} catch (e) {
  node_gc = null;
  gc = {
    'collect': function() {
      console.log("ERROR: Node-GC doesn't exists or doesn't builded.");
    }
  };
}

sys.puts("Welcome to the memory leaks finder!");
sys.puts("Type 'help' for options.");
gc.collect();
show_memory_usage();

process.stdin.resume();
process.stdin.setEncoding('utf8');

stdin = process.stdin;
stdout = process.stdout;

rli = readline.createInterface(stdin, stdout, function (text) {
  var
    completions = [],
    completeOn,
    i;
  
  completeOn = text;
  for (i in commands) {
    if (i.match(new RegExp("^" + text))) {
      completions.push(i);
    }
  }
  
  return [completions, completeOn];
});

rli.on("SIGINT", function () {
  rli.close();
});

rli.addListener('close', function () {
  show_memory_usage();
  stdin.destroy();
});

rli.addListener('line', function (cmd) {
  var
    pair = cmd.trim().split(/\s+/),
    i;

  pair[0] = pair[0].trim();
  pair[1] = parseInt(pair[1], 10) > 0 ? parseInt(pair[1], 10) : 1;

  if (commands[pair[0]]) {
    try {
      for (i = 0; i < pair[1]; i += 1) {
        commands[pair[0]].apply();
      }
    } catch (e) {
      stdout.write("Exception caused!\n");
      stdout.write(sys.inspect(e.stack) + "\n");
    }
    if (pair[0] !== "help") {
      show_memory_usage();
    }
  } else if (pair[0] !== "") {
    stdout.write("Unrecognized command: " + pair[0] + "\n");
    commands.help();
  }

  rli.prompt();
});
rli.setPrompt(prompt);
rli.prompt();

