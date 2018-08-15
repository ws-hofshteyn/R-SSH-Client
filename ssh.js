'use strict';

const program = require('commander');
const fs = require('fs');
var Client = require('ssh2').Client;
const readline = require('readline');
require('log-timestamp')(() => { return '[ ' + new Date().getHours() + ':' +  new Date().getMinutes() + ':' + new Date().getSeconds() + ' ]' });

let prefix, suffix, command = '';
let stackPathCommands = [];
const sshClient = new Client();


program
    .option('-p, --port <n>', parseInt)
    .option('-k, --key <n>')
    // .option('-L, --local <n>')
    // .option('-R, --remote <n>')
    .parse(process.argv);

const connectionString = program.args[0];
let connectionData = {};

if (connectionString) {
    connectionData.host = connectionString.split('@')[1];
    connectionData.username = connectionString.split(':')[0];
    connectionData.password = connectionString.split(':')[1].split('@')[0];
    connectionData.port = program.port || 22;
    connectionData.privateKey = program.key ? fs.readFileSync(program.key) : null;
    prefix = connectionData.username + ':' + connectionData.host + ':';
} else {
    const error = new Error('Wrong connection data');
    console.error(error);
}

let completions = [];

function getPath () {
    const execCommand = !stackPathCommands.length ? '' : stackPathCommands.join(' && ') + ' &&';
    return new Promise((resolve, reject) => {
        sshClient.exec(execCommand + ' pwd', (err, stream) => {
            if (err) reject(err);
            stream.on('data', function(buffer) {
                const path = buffer.toString().split('\n')[0];
                suffix = !suffix ? '~# ' : path + '# ';
                resolve(path);
            }).stderr.on('data', function(data) {
                console.log(`${data}`);
                resolve();
            });
        })
    })
}

function getCompletions (path) {
    const execCommand = path ? 'cd ' + path + ' && ls' : 'ls';
    return new Promise((resolve, reject) => {
        sshClient.exec(execCommand, (err, stream) => {
            if (err) reject(err);
            stream.on('data', function(buffer) {
                const data = buffer.toString().split('\n');
                completions = data;
                resolve(data);
            }).stderr.on('data', function(data) {
                console.log('' + data);
                resolve();
            });
        })
    })
}

function completer(line) {
    let hits; 
    if (line.indexOf(' ') !== -1) {
        line = line.split(' ');
        const toComplete = line[line.length -1];
        hits = completions.filter((c) => c.startsWith(toComplete));
    } else {
        hits = completions.filter((c) => c.startsWith(line));
    }
    return [hits.length ? hits : completions, line];
}

function startShellSession() {

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: prefix + suffix,
        completer: completer
    });

    sshClient.shell((err, stream) => {

        if (err) throw err;
        
        stream.on('close', () => {

            process.stdout.write('Connection closed.\n');
            sshClient.end();
            rl.close();

        }).on('data', (data) => {
            
            process.stdin.pause();
            process.stdout.write(data)
            process.stdin.resume();
            rl.prompt();

        }).stderr.on('data', (data) => {
            process.stderr.write(data);
        });

        rl.on('line', (input) => {
            
            command = input;

            if (command) {
                if ((/get\s/).test(command)) {
                    getFile(command)
                        .then(() => stream.write('\n'))
                        .catch((err) => console.log(err));
                } else if ((/put\s/).test(command)) {
                    putFile(command)
                        .then(() => stream.write('\n'))
                        .catch((err) => console.log(err));
                } else if ((/cd\s/).test(command)) {
                    stackPathCommands.push(command);
                    getPath()
                        .then((path) => {
                            return getCompletions(path);
                        })
                        .then(() => {
                            rl.setPrompt(prefix + suffix);
                            stream.write(command + '\n');
                        })
                        .catch((err) => console.log(err));

                } else {
                    stream.write(command.trim() + '\n');
                    rl.prompt();
                }
            }
        }).on('SIGINT', () => {
            console.log('Ending session.');
            process.stdin.pause();
            stream.end('exit\n');
            process.exit();
        })
    })
}

sshClient.connect(connectionData);

sshClient.on('ready', () => {
    getPath()
        .then((path) => {
            return getCompletions(path);
        })
        .then(() => {
            console.log('Connection successful.');
            startShellSession();
        })
        .catch((err) => console.log(err));
})

function getFile (input) {
    return new Promise((resolve, reject) => {
        
        const file = input.split('get ')[1];
        console.log('Downloading to ' + __dirname + ' from ' + connectionData.host);
        
        sshClient.sftp((err, sftp) => {
        
            if (err) reject(err);
        
            sftp.fastGet(file, './output/' + file, {}, (downloadErr) => {
                if (downloadErr) reject(downloadErr);
                console.log('File was downloaded successfully');
                resolve();
            })
        })
    })
}

function putFile (input) {
    return new Promise ((resolve, reject) => {

        const file = input.split('put ')[1];
        console.log('Upload ' + file + ' to ' + connectionData.host);
        sshClient.sftp((err, sftp) => {
            if (err) reject(err);
            
            const readStream = fs.createReadStream(file);
            const writeStream = sftp.createWriteStream('./' + file);
    
            writeStream.on('close', () => {
                console.log('File was uploaded successfully');
                resolve();
            }).on('error', (err) => {
                reject(err);
            })
    
            readStream.pipe(writeStream);
        })
    })
}