'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

var _constants;

function _load_constants() {
  return _constants = _interopRequireWildcard(require('./constants.js'));
}

var _index;

function _load_index() {
  return _index = require('./registries/index.js');
}

var _fs;

function _load_fs() {
  return _fs = _interopRequireWildcard(require('./util/fs.js'));
}

var _misc;

function _load_misc() {
  return _misc = require('./util/misc.js');
}

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const invariant = require('invariant');
const path = require('path');

/**
 *
 */
class InstallationIntegrityChecker {
  constructor(config, reporter) {
    this.config = config;
    this.reporter = reporter;
  }

  /**
   * Get the location of an existing integrity hash. If none exists then return the location where we should
   * write a new one.
   */

  _getIntegrityHashLocation(usedRegistries) {
    var _this = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      // build up possible folders
      let registries = (_index || _load_index()).registryNames;
      if (usedRegistries && usedRegistries.size > 0) {
        registries = usedRegistries;
      }
      const possibleFolders = [];
      if (_this.config.modulesFolder) {
        possibleFolders.push(_this.config.modulesFolder);
      }

      // ensure we only write to a registry folder that was used
      for (const name of registries) {
        const loc = path.join(_this.config.cwd, _this.config.registries[name].folder);
        possibleFolders.push(loc);
      }

      // if we already have an integrity hash in one of these folders then use it's location otherwise use the
      // first folder
      let loc;
      for (const possibleLoc of possibleFolders) {
        if (yield (_fs || _load_fs()).exists(path.join(possibleLoc, (_constants || _load_constants()).INTEGRITY_FILENAME))) {
          loc = possibleLoc;
          break;
        }
      }
      const locationFolder = loc || possibleFolders[0];
      const locationPath = path.join(locationFolder, (_constants || _load_constants()).INTEGRITY_FILENAME);
      return {
        locationFolder,
        locationPath,
        exists: !!loc
      };
    })();
  }

  /**
   * returns a list of files recursively in a directory sorted
   */
  _getFilesDeep(rootDir) {
    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      let getFilePaths = (() => {
        var _ref = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (rootDir, files) {
          let currentDir = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : rootDir;

          for (const file of yield (_fs || _load_fs()).readdir(currentDir)) {
            const entry = path.join(currentDir, file);
            const stat = yield (_fs || _load_fs()).stat(entry);
            if (stat.isDirectory()) {
              yield getFilePaths(rootDir, files, entry);
            } else {
              files.push(path.relative(rootDir, entry));
            }
          }
        });

        return function getFilePaths(_x, _x2) {
          return _ref.apply(this, arguments);
        };
      })();

      const result = [];
      yield getFilePaths(rootDir, result);
      return result;
    })();
  }

  /**
   * Generate integrity hash of input lockfile.
   */

  _generateIntegrityFile(lockfile, patterns, flags, modulesFolder) {
    var _this2 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {

      const result = {
        flags: [],
        linkedModules: [],
        topLevelPatters: [],
        lockfileEntries: {},
        files: []
      };

      result.topLevelPatters = patterns.sort((_misc || _load_misc()).sortAlpha);

      if (flags.flat) {
        result.flags.push('flat');
      }

      if (_this2.config.production) {
        result.flags.push('production');
      }

      const linkedModules = _this2.config.linkedModules;
      if (linkedModules.length) {
        result.linkedModules = linkedModules.sort((_misc || _load_misc()).sortAlpha);
      }

      Object.keys(lockfile).forEach(function (key) {
        result.lockfileEntries[key] = lockfile[key].resolved;
      });

      if (flags.checkFiles) {
        result.files = yield _this2._getFilesDeep(modulesFolder);
      }

      return result;
    })();
  }

  _compareIntegrityFiles(actual, expected) {
    if (!(0, (_misc || _load_misc()).compareSortedArrays)(actual.linkedModules, expected.linkedModules)) {
      this.reporter.warn(this.reporter.lang('integrityCheckLinkedModulesDontMatch'));
      return false;
    }
    if (!(0, (_misc || _load_misc()).compareSortedArrays)(actual.topLevelPatters, expected.topLevelPatters)) {
      this.reporter.warn(this.reporter.lang('integrityPatternsDontMatch'));
      return false;
    }
    if (!(0, (_misc || _load_misc()).compareSortedArrays)(actual.flags, expected.flags)) {
      this.reporter.warn(this.reporter.lang('integrityFlagsDontMatch'));
      return false;
    }
    for (const key of Object.keys(actual.lockfileEntries)) {
      if (actual.lockfileEntries[key] !== expected.lockfileEntries[key]) {
        this.reporter.warn(this.reporter.lang('integrityLockfilesDontMatch'));
        return false;
      }
    }
    for (const key of Object.keys(expected.lockfileEntries)) {
      if (actual.lockfileEntries[key] !== expected.lockfileEntries[key]) {
        this.reporter.warn(this.reporter.lang('integrityLockfilesDontMatch'));
        return false;
      }
    }
    return true;
  }

  check(patterns, lockfile, flags) {
    var _this3 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      // check if patterns exist in lockfile
      const missingPatterns = patterns.filter(function (p) {
        return !lockfile[p];
      });
      const loc = yield _this3._getIntegrityHashLocation();
      if (missingPatterns.length || !loc.exists) {
        return {
          integrityFileMissing: !loc.exists,
          missingPatterns
        };
      }

      const actual = yield _this3._generateIntegrityFile(lockfile, patterns, Object.assign({}, { checkFiles: false }, flags), // don't generate files when checking, we check the files below
      loc.locationFolder);
      const expectedRaw = yield (_fs || _load_fs()).readFile(loc.locationPath);
      let expected;
      try {
        expected = JSON.parse(expectedRaw);
      } catch (e) {
        // ignore JSON parsing for legacy text integrity files compatibility
      }
      let integrityMatches;
      if (expected) {
        integrityMatches = _this3._compareIntegrityFiles(actual, expected);
        if (flags.checkFiles && expected.files.length === 0) {
          // edge case handling - --check-fies is passed but .yarn-integrity does not contain any files
          // check and fail if there are file in node_modules after all.
          const actualFiles = yield _this3._getFilesDeep(loc.locationFolder);
          if (actualFiles.length > 0) {
            _this3.reporter.warn(_this3.reporter.lang('integrityFailedFilesMissing'));
            integrityMatches = false;
          }
        } else if (flags.checkFiles && expected.files.length > 0) {
          // TODO we may want to optimise this check by checking only for package.json files on very large trees
          for (const file of expected.files) {
            if (!(yield (_fs || _load_fs()).exists(path.join(loc.locationFolder, file)))) {
              _this3.reporter.warn(_this3.reporter.lang('integrityFailedFilesMissing'));
              integrityMatches = false;
              break;
            }
          }
        }
      } else {
        integrityMatches = false;
      }

      return {
        integrityFileMissing: false,
        integrityMatches,
        missingPatterns
      };
    })();
  }

  /**
   * Write the integrity hash of the current install to disk.
   */
  save(patterns, lockfile, flags, usedRegistries) {
    var _this4 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      const loc = yield _this4._getIntegrityHashLocation(usedRegistries);
      invariant(loc.locationPath, 'expected integrity hash location');
      yield (_fs || _load_fs()).mkdirp(path.dirname(loc.locationPath));
      const integrityFile = yield _this4._generateIntegrityFile(lockfile, patterns, flags, loc.locationFolder);
      yield (_fs || _load_fs()).writeFile(loc.locationPath, JSON.stringify(integrityFile, null, 2));
    })();
  }

  removeIntegrityFile() {
    var _this5 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      const loc = yield _this5._getIntegrityHashLocation();
      if (loc.exists) {
        yield (_fs || _load_fs()).unlink(loc.locationPath);
      }
    })();
  }

}
exports.default = InstallationIntegrityChecker;