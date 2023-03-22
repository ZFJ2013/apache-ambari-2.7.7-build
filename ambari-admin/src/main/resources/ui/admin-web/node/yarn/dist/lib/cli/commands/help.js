'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.run = run;

var _index;

function _load_index() {
  return _index = _interopRequireWildcard(require('./index.js'));
}

var _constants;

function _load_constants() {
  return _constants = _interopRequireWildcard(require('../../constants.js'));
}

var _misc;

function _load_misc() {
  return _misc = require('../../util/misc.js');
}

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

const chalk = require('chalk');

function run(config, reporter, commander, args) {
  const getDocsLink = name => `${(_constants || _load_constants()).YARN_DOCS}${name || ''}`;
  const getDocsInfo = name => 'Visit ' + chalk.bold(getDocsLink(name)) + ' for documentation about this command.';

  if (args.length) {
    const helpCommand = (0, (_misc || _load_misc()).hyphenate)(args[0]);
    if ((_index || _load_index())[helpCommand]) {
      commander.on('--help', () => console.log('  ' + getDocsInfo(helpCommand) + '\n'));
    }
  } else {
    commander.on('--help', () => {
      console.log('  Commands:\n');
      for (const name of Object.keys(_index || _load_index()).sort((_misc || _load_misc()).sortAlpha)) {
        if ((_index || _load_index())[name].useless) {
          continue;
        }

        console.log(`    - ${(0, (_misc || _load_misc()).hyphenate)(name)}`);
      }
      console.log('\n  Run `' + chalk.bold('yarn help COMMAND') + '` for more information on specific commands.');
      console.log('  Visit ' + chalk.bold(getDocsLink()) + ' to learn more about Yarn.\n');
    });
  }
  commander.help();
  return Promise.resolve();
}