#!/usr/bin/env node

var program = require('commander'),
    chalk = require('chalk'),
    updateNotifier = require('update-notifier'),
    fs = require("fs"),
    tiappxml = require('tiapp.xml'),
    pkg = require('../package.json'),
    xpath = require('xpath'),
    copy = require('copy-files'),
    ncp = require('ncp').ncp;

tich();

// main function
function tich() {

    // status command, shows the current config
    function status() {

        var tiapp = tiappxml.load(outfile);

        var alloyCfg;
        var isAlloy = false;
        if (fs.existsSync("./app/config.json")) {
            isAlloy = true;
            alloyCfg = JSON.parse(fs.readFileSync("./app/config.json", "utf-8"));
        }

        console.log('\n');
        console.log('Name: ' + chalk.cyan(tiapp.name));
        console.log('AppId: ' + chalk.cyan(tiapp.id));
        console.log('Version: ' + chalk.cyan(tiapp.version));
        console.log('GUID: ' + chalk.cyan(tiapp.guid));

        if( isAlloy ){
            console.log('Alloy Theme: ' + chalk.cyan(alloyCfg.global.theme || "not defined"));
        }

        console.log('\n');
    }

    // select a new config by name
    function select(name, outfilename) {
        var regex = /\$tiapp\.(.*)\$/;

        if (!name) {
            console.log(chalk.red('No config specified, nothing to do.'));
            status();

        } else {

            cfg.configs.forEach(function(config) {

                if (config.name === name ) {
                    if (config.hasOwnProperty('tiapp')){
                        infile = './TiCh/templates/' + config.tiapp;

                        if (!fs.existsSync(infile)) {
                            console.log(chalk.red('Cannot find ' + infile));
                            status();
                        }
                    }
                }

            });
            
            // read in the app config
            var tiapp = tiappxml.load(infile);

            var alloyCfg;
            var isAlloy = false;
            if (fs.existsSync("./app/config.json")) {
                isAlloy = true;
                alloyCfg = JSON.parse(fs.readFileSync("./app/config.json", "utf-8"));
            }

            // find the config name specified
            cfg.configs.forEach(function(config) {

                if (config.name === name || config.name === "global") {
                    console.log('\nFound a config for ' + chalk.cyan(config.name) + '\n');

                    for (var setting in config.settings) {

                        if (!config.settings.hasOwnProperty(setting)) continue;

                        if (setting != "properties" && setting != "raw") {

                            var now = new Date();
                            var replaceWith = config.settings[setting]
                                .replace('$DATE$', now.toLocaleDateString())
                                .replace('$TIME$', now.toLocaleTimeString())
                                .replace('$DATETIME$', now.toLocaleString())
                                .replace('$TIME_EPOCH$', now.getTime().toString());

                            var matches = regex.exec(replaceWith);

                            if (matches && matches[1]) {
                                var propName = matches[1];
                                replaceWith = replaceWith.replace(regex, tiapp[propName]);
                            }

                            tiapp[setting] = replaceWith;

                            console.log('Changing ' + chalk.cyan(setting) + ' to ' + chalk.yellow(replaceWith));
                        }
                    }


                    if (config.settings.properties) {
                        for (var property in config.settings.properties) {

                            if (!config.settings.properties.hasOwnProperty(property)) continue;

                            var replaceWith = config.settings.properties[property]
                                .replace('$DATE$', new Date().toLocaleDateString())
                                .replace('$TIME$', new Date().toLocaleTimeString())
                                .replace('$DATETIME$', new Date().toLocaleString())
                                .replace('$TIME_EPOCH$', new Date().getTime().toString());


                            var matches = regex.exec(replaceWith);
                            if (matches && matches[1]) {
                                var propName = matches[1];
                                replaceWith = replaceWith.replace(regex, tiapp[propName]);
                            }

                            tiapp.setProperty(property, replaceWith);

                            console.log('Changing App property ' + chalk.cyan(property) + ' to ' + chalk.yellow(replaceWith));

                        }
                    }


                    if (config.settings.raw) {
                        var doc = tiapp.doc;
                        var select = xpath.useNamespaces({
                            "ti": "http://ti.appcelerator.org",
                            "android": "http://schemas.android.com/apk/res/android",
                            "ios": ""
                        });
                        for (var path in config.settings.raw) {

                            if (!config.settings.raw.hasOwnProperty(path)) continue;

                            var node = select(path, doc, true);
                            if (!node) {
                                console.log(chalk.yellow('Could not find ' + path + ", skipping"));
                                continue;
                            }

                            var replaceWith = config.settings.raw[path]
                                .replace('$DATE$', new Date().toLocaleDateString())
                                .replace('$TIME$', new Date().toLocaleTimeString())
                                .replace('$DATETIME$', new Date().toLocaleString())
                                .replace('$TIME_EPOCH$', new Date().getTime().toString());


                            var matches = regex.exec(replaceWith);
                            if (matches && matches[1]) {
                                var propName = matches[1];
                                replaceWith = replaceWith.replace(regex, tiapp[propName]);
                            }

                            

                            if (typeof(node.value) === 'undefined'){
                                node.firstChild.data = replaceWith;
                            }
                            else{
                                node.value = replaceWith;
                            }

                            console.log('Changing Raw property ' + chalk.cyan(path) + ' to ' + chalk.yellow(replaceWith));

                        }
                    }

                    if( config.name != "global"){

                        //Update theme on Alloy config only if it's not global configuration
                        if( isAlloy && processAlloy ){
                            alloyCfg.global.theme = name;
                            console.log('Changing ' + chalk.cyan('Alloy Theme') + ' to ' + chalk.yellow(alloyCfg.global.theme));
                            
                            if( fs.existsSync('./app/themes/' + alloyCfg.global.theme + '/config.json') ){
                                var configTheme = JSON.parse(fs.readFileSync('./app/themes/' + alloyCfg.global.theme + '/config.json', 'utf-8'));
                                console.log('Updating Alloy config.json with theme configuration file');

                                Object.keys(configTheme).forEach(function( rootconfig ){
                                    if( alloyCfg[rootconfig] ){
                                        Object.keys(configTheme[rootconfig]).forEach(function( innerconfig ){
                                            alloyCfg[rootconfig][innerconfig] = configTheme[rootconfig][innerconfig];
                                            console.log('Changing ' + chalk.cyan('config.' + rootconfig + '.' + innerconfig) + ' to ' + chalk.yellow(configTheme[rootconfig][innerconfig]));
                                        });
                                    }
                                });

                            }


                            fs.writeFileSync("./app/config.json", JSON.stringify(alloyCfg, null, 4));
                        }

                        var assetsDirectory = './app/themes/' + alloyCfg.global.theme + '/assets/'

                        if( fs.existsSync(assetsDirectory) ){
                            ncp(assetsDirectory, './app/assets/', function (err) {
                                if (err) {
                                    return console.error(err);
                                }

                                console.log('Assets from ' + assetsDirectory + ' copied');
                            });
                        }

                        //Remove previous LaunchScreen

                        if( fs.existsSync('./app/platform/iphone') ){

                            fs.readdir('./app/platform/iphone', function(err, files){

                                files.forEach(function(file){
                                    fs.unlinkSync('./app/platform/iphone/' + file)
                                    console.log( chalk.cyan('Removing ./app/platform/iphone/' + file) );
                                });

                                fs.rmdirSync('./app/platform/iphone');
                                console.log( chalk.cyan('Platform iphone removed') );
                            })
                        }

                        var platformDirectory = './app/themes/' + alloyCfg.global.theme + '/platform/'

                        if( fs.existsSync(platformDirectory) ){
                            ncp(platformDirectory, './app/platform/', function (err) {
                                if (err) {
                                    return console.error(err);
                                }

                                console.log('Platform from ' + platformDirectory + ' copied');
                            });
                        }
                        
                        //Update DefaultIcon
                        var defaultIcon = './app/assets/iphone/iTunesArtwork@2x.png';

                        if (fs.existsSync('./app/themes/' + alloyCfg.global.theme + '/assets/iphone/iTunesArtwork@2x.png')) {
                            defaultIcon = './app/themes/' + alloyCfg.global.theme + '/assets/iphone/iTunesArtwork@2x.png';
                        }

                        copy({
                          files: {
                            'DefaultIcon.png': defaultIcon
                          },
                          dest: './',
                          overwrite: true
                        }, function (err) {
                            console.log('Updating DefaultIcon.png');
                        });


                        //Update LaunchLogo
                        var defaultLaunchLogo = './app/assets/iphone/LaunchLogo.png';

                        if (fs.existsSync('./app/themes/' + alloyCfg.global.theme + '/assets/iphone/LaunchLogo.png')) {
                            defaultLaunchLogo = './app/themes/' + alloyCfg.global.theme + '/assets/iphone/LaunchLogo.png';
                        }

                        copy({
                          files: {
                            'LaunchLogo.png': defaultLaunchLogo
                          },
                          dest: './',
                          overwrite: true
                        }, function (err) {
                            console.log('Updating LaunchLogo.png');
                        });
                        
                        console.log(chalk.green('\n' + outfilename + ' updated\n'));

                        tiapp.write(outfilename);

                    }

                }
            });

            //console.log(chalk.red('\nCouldn\'t find a config called: ' + name + '\n'));

        }
    }

    // setup CLI
    program
        .version(pkg.version, '-v, --version')
        .usage('[options]')
        .description(pkg.description)
        .option('-l, --list', 'Lists the configurations in the project folder')
        .option('-f, --cfgfile <path>', 'Specifies the tich config file to use')
        .option('-i, --in <path>', 'Specifies the file to read (default: tiapp.xml)')
        .option('-o, --out <path>', 'Specifies the file to write (default: tiapp.xml)')
        .option('-s, --select <name>', 'Updates TiApp.xml to config specified by <name>')
        .option('--noalloy', 'Do no update theme on Alloy config')
        //.option('-c, --capture <name>', "Stores the current values of TiApp.xml id, name, version as <name> ")

    program.parse(process.argv);

    var cfgfile = program.cfgfile ? program.cfgfile : 'tich.cfg';
    var infile = program.in ? program.in : './tiapp.xml';
    var outfile = program.out ? program.out : './tiapp.xml';
    var processAlloy = program.noalloy ? false : true;

    // check that all required input paths are good
    [cfgfile, infile].forEach(function (file) {
        if (!fs.existsSync(file)) {
            console.log(chalk.red('Cannot find ' + file));
            program.help();
        }
    });

    // read in our config
    var cfg = JSON.parse(fs.readFileSync(cfgfile, "utf-8"));

    // check for a new version
    updateNotifier({
        packageName: pkg.name,
        packageVersion: pkg.version
    }).notify();

    // LIST command - show the list of config items
    if (program.list) {
        cfg.configs.forEach(function(config) {
            console.log(chalk.cyan(config.name + ' - ' + chalk.grey('Name: ') + config.settings.name + ' ' + chalk.grey('Id: ') + config.settings.id + ' ' + chalk.grey('Version: ') + config.settings.version));
        });

    // select command, select based on the arg passed
    } else if (program.select) {

        select(program.select, outfile);

    // capture command - this will store the current TiApp.xml settings
    } else if (program.capture) {
        // coming soon!

    } else {

        status();

    }

}

