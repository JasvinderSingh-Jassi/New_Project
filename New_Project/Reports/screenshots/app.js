var app = angular.module('reportingApp', []);

//<editor-fold desc="global helpers">

var isValueAnArray = function (val) {
    return Array.isArray(val);
};

var getSpec = function (str) {
    var describes = str.split('|');
    return describes[describes.length - 1];
};
var checkIfShouldDisplaySpecName = function (prevItem, item) {
    if (!prevItem) {
        item.displaySpecName = true;
    } else if (getSpec(item.description) !== getSpec(prevItem.description)) {
        item.displaySpecName = true;
    }
};

var getParent = function (str) {
    var arr = str.split('|');
    str = "";
    for (var i = arr.length - 2; i > 0; i--) {
        str += arr[i] + " > ";
    }
    return str.slice(0, -3);
};

var getShortDescription = function (str) {
    return str.split('|')[0];
};

var countLogMessages = function (item) {
    if ((!item.logWarnings || !item.logErrors) && item.browserLogs && item.browserLogs.length > 0) {
        item.logWarnings = 0;
        item.logErrors = 0;
        for (var logNumber = 0; logNumber < item.browserLogs.length; logNumber++) {
            var logEntry = item.browserLogs[logNumber];
            if (logEntry.level === 'SEVERE') {
                item.logErrors++;
            }
            if (logEntry.level === 'WARNING') {
                item.logWarnings++;
            }
        }
    }
};

var convertTimestamp = function (timestamp) {
    var d = new Date(timestamp),
        yyyy = d.getFullYear(),
        mm = ('0' + (d.getMonth() + 1)).slice(-2),
        dd = ('0' + d.getDate()).slice(-2),
        hh = d.getHours(),
        h = hh,
        min = ('0' + d.getMinutes()).slice(-2),
        ampm = 'AM',
        time;

    if (hh > 12) {
        h = hh - 12;
        ampm = 'PM';
    } else if (hh === 12) {
        h = 12;
        ampm = 'PM';
    } else if (hh === 0) {
        h = 12;
    }

    // ie: 2013-02-18, 8:35 AM
    time = yyyy + '-' + mm + '-' + dd + ', ' + h + ':' + min + ' ' + ampm;

    return time;
};

var defaultSortFunction = function sortFunction(a, b) {
    if (a.sessionId < b.sessionId) {
        return -1;
    } else if (a.sessionId > b.sessionId) {
        return 1;
    }

    if (a.timestamp < b.timestamp) {
        return -1;
    } else if (a.timestamp > b.timestamp) {
        return 1;
    }

    return 0;
};

//</editor-fold>

app.controller('ScreenshotReportController', ['$scope', '$http', 'TitleService', function ($scope, $http, titleService) {
    var that = this;
    var clientDefaults = {};

    $scope.searchSettings = Object.assign({
        description: '',
        allselected: true,
        passed: true,
        failed: true,
        pending: true,
        withLog: true
    }, clientDefaults.searchSettings || {}); // enable customisation of search settings on first page hit

    this.warningTime = 1400;
    this.dangerTime = 1900;
    this.totalDurationFormat = clientDefaults.totalDurationFormat;
    this.showTotalDurationIn = clientDefaults.showTotalDurationIn;

    var initialColumnSettings = clientDefaults.columnSettings; // enable customisation of visible columns on first page hit
    if (initialColumnSettings) {
        if (initialColumnSettings.displayTime !== undefined) {
            // initial settings have be inverted because the html bindings are inverted (e.g. !ctrl.displayTime)
            this.displayTime = !initialColumnSettings.displayTime;
        }
        if (initialColumnSettings.displayBrowser !== undefined) {
            this.displayBrowser = !initialColumnSettings.displayBrowser; // same as above
        }
        if (initialColumnSettings.displaySessionId !== undefined) {
            this.displaySessionId = !initialColumnSettings.displaySessionId; // same as above
        }
        if (initialColumnSettings.displayOS !== undefined) {
            this.displayOS = !initialColumnSettings.displayOS; // same as above
        }
        if (initialColumnSettings.inlineScreenshots !== undefined) {
            this.inlineScreenshots = initialColumnSettings.inlineScreenshots; // this setting does not have to be inverted
        } else {
            this.inlineScreenshots = false;
        }
        if (initialColumnSettings.warningTime) {
            this.warningTime = initialColumnSettings.warningTime;
        }
        if (initialColumnSettings.dangerTime) {
            this.dangerTime = initialColumnSettings.dangerTime;
        }
    }


    this.chooseAllTypes = function () {
        var value = true;
        $scope.searchSettings.allselected = !$scope.searchSettings.allselected;
        if (!$scope.searchSettings.allselected) {
            value = false;
        }

        $scope.searchSettings.passed = value;
        $scope.searchSettings.failed = value;
        $scope.searchSettings.pending = value;
        $scope.searchSettings.withLog = value;
    };

    this.isValueAnArray = function (val) {
        return isValueAnArray(val);
    };

    this.getParent = function (str) {
        return getParent(str);
    };

    this.getSpec = function (str) {
        return getSpec(str);
    };

    this.getShortDescription = function (str) {
        return getShortDescription(str);
    };
    this.hasNextScreenshot = function (index) {
        var old = index;
        return old !== this.getNextScreenshotIdx(index);
    };

    this.hasPreviousScreenshot = function (index) {
        var old = index;
        return old !== this.getPreviousScreenshotIdx(index);
    };
    this.getNextScreenshotIdx = function (index) {
        var next = index;
        var hit = false;
        while (next + 2 < this.results.length) {
            next++;
            if (this.results[next].screenShotFile && !this.results[next].pending) {
                hit = true;
                break;
            }
        }
        return hit ? next : index;
    };

    this.getPreviousScreenshotIdx = function (index) {
        var prev = index;
        var hit = false;
        while (prev > 0) {
            prev--;
            if (this.results[prev].screenShotFile && !this.results[prev].pending) {
                hit = true;
                break;
            }
        }
        return hit ? prev : index;
    };

    this.convertTimestamp = convertTimestamp;


    this.round = function (number, roundVal) {
        return (parseFloat(number) / 1000).toFixed(roundVal);
    };


    this.passCount = function () {
        var passCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.passed) {
                passCount++;
            }
        }
        return passCount;
    };


    this.pendingCount = function () {
        var pendingCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.pending) {
                pendingCount++;
            }
        }
        return pendingCount;
    };

    this.failCount = function () {
        var failCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (!result.passed && !result.pending) {
                failCount++;
            }
        }
        return failCount;
    };

    this.totalDuration = function () {
        var sum = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.duration) {
                sum += result.duration;
            }
        }
        return sum;
    };

    this.passPerc = function () {
        return (this.passCount() / this.totalCount()) * 100;
    };
    this.pendingPerc = function () {
        return (this.pendingCount() / this.totalCount()) * 100;
    };
    this.failPerc = function () {
        return (this.failCount() / this.totalCount()) * 100;
    };
    this.totalCount = function () {
        return this.passCount() + this.failCount() + this.pendingCount();
    };


    var results = [
    {
        "description": "Enter username|Interact with Frames",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 28152,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.90"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "images\\003b00e7-0082-0022-0083-00d00050000b.png",
        "timestamp": 1617200415053,
        "duration": 13109
    },
    {
        "description": "switch to default content|Interact with Frames",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 28152,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.90"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "images\\000200f7-0099-00d1-00e7-0031006e00df.png",
        "timestamp": 1617200428719,
        "duration": 3973
    },
    {
        "description": "Switch to new window|Interact with Frames",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 28152,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.90"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://the-internet.herokuapp.com/windows - Access to XMLHttpRequest at 'https://298279967.log.optimizely.com/event?a=298279967&d=298279967&y=false&n=https%3A%2F%2Fthe-internet.herokuapp.com%2Fwindows&u=oeu1617200436928r0.918754811860286&wxhr=true&t=1617200436939&f=298349752,318188263' from origin 'https://the-internet.herokuapp.com' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.",
                "timestamp": 1617200439026,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://298279967.log.optimizely.com/event?a=298279967&d=298279967&y=false&n=https%3A%2F%2Fthe-internet.herokuapp.com%2Fwindows&u=oeu1617200436928r0.918754811860286&wxhr=true&t=1617200436939&f=298349752,318188263 - Failed to load resource: net::ERR_FAILED",
                "timestamp": 1617200439027,
                "type": ""
            }
        ],
        "screenShotFile": "images\\00a80060-00bf-0084-00eb-009700af0042.png",
        "timestamp": 1617200433092,
        "duration": 10715
    },
    {
        "description": "Enter username|Interact with Frames",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5276,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.114"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "images\\00d00070-00e9-00c4-005d-00ab006a000b.png",
        "timestamp": 1618382876460,
        "duration": 9725
    },
    {
        "description": "switch to default content|Interact with Frames",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5276,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.114"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "images\\00ab0002-005b-0024-0023-008a00ba00d2.png",
        "timestamp": 1618382886785,
        "duration": 3933
    },
    {
        "description": "Switch to new window|Interact with Frames",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5276,
        "browser": {
            "name": "chrome",
            "version": "89.0.4389.114"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://298279967.log.optimizely.com/event?a=298279967&d=298279967&y=false&n=https%3A%2F%2Fthe-internet.herokuapp.com%2Fwindows&u=oeu1618382893635r0.8014808160403475&wxhr=true&t=1618382893641&f=298349752,318188263 - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1618382893889,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://298279967.log.optimizely.com/event?a=298279967&d=298279967&y=false&n=engagement&g=298283957&u=oeu1618382893635r0.8014808160403475&wxhr=true&t=1618382895101&f=298349752,318188263 - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1618382895139,
                "type": ""
            }
        ],
        "screenShotFile": "images\\00c90003-0093-0057-00a3-00d4008e003c.png",
        "timestamp": 1618382890996,
        "duration": 7863
    },
    {
        "description": "Enter username|Interact with Frames",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17556,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.72"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "images\\003d005b-00a8-009b-00d8-009900c80055.png",
        "timestamp": 1619154829333,
        "duration": 30790
    },
    {
        "description": "switch to default content|Interact with Frames",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17556,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.72"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "images\\00fb006a-00d1-0074-0070-006b0098001b.png",
        "timestamp": 1619154860495,
        "duration": 4479
    },
    {
        "description": "Switch to new window|Interact with Frames",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17556,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.72"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://298279967.log.optimizely.com/event?a=298279967&d=298279967&y=false&n=https%3A%2F%2Fthe-internet.herokuapp.com%2Fwindows&u=oeu1619154871214r0.9314357845993149&wxhr=true&t=1619154871221&f=298349752,318188263 - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1619154871487,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://298279967.log.optimizely.com/event?a=298279967&d=298279967&y=false&n=engagement&g=298283957&u=oeu1619154871214r0.9314357845993149&wxhr=true&t=1619154883874&f=298349752,318188263 - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1619154883902,
                "type": ""
            }
        ],
        "screenShotFile": "images\\006200ba-007d-008b-00c8-006900b90015.png",
        "timestamp": 1619154865115,
        "duration": 22646
    },
    {
        "description": "Enter username|Interact with Frames",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9868,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.72"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "images\\00f4001e-009a-00ac-00d7-009300d900a7.png",
        "timestamp": 1619155190078,
        "duration": 19973
    },
    {
        "description": "switch to default content|Interact with Frames",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9868,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.72"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "images\\008600f7-0047-00dc-00b8-00d200de0021.png",
        "timestamp": 1619155210348,
        "duration": 3847
    },
    {
        "description": "Switch to new window|Interact with Frames",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 9868,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.72"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://298279967.log.optimizely.com/event?a=298279967&d=298279967&y=false&n=https%3A%2F%2Fthe-internet.herokuapp.com%2Fwindows&u=oeu1619155218842r0.30534044875106203&wxhr=true&t=1619155218846&f=298349752,318188263 - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1619155219718,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://298279967.log.optimizely.com/event?a=298279967&d=298279967&y=false&n=engagement&g=298283957&u=oeu1619155218842r0.30534044875106203&wxhr=true&t=1619155230138&f=298349752,318188263 - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1619155230166,
                "type": ""
            }
        ],
        "screenShotFile": "images\\00560059-0004-002e-00c1-00f000cd00df.png",
        "timestamp": 1619155214345,
        "duration": 19284
    },
    {
        "description": "Enter username|Interact with Frames",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3836,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.72"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "images\\004000a7-0053-00d0-000d-000d002600d2.png",
        "timestamp": 1619157591818,
        "duration": 30799
    },
    {
        "description": "switch to default content|Interact with Frames",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3836,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.72"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "images\\006e0023-00db-00ed-000e-00bc00c7009b.png",
        "timestamp": 1619157623249,
        "duration": 4334
    },
    {
        "description": "Switch to new window|Interact with Frames",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 3836,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.72"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\Jasvinder Singh\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:554:17)\n    at processTimers (internal/timers.js:497:7)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://298279967.log.optimizely.com/event?a=298279967&d=298279967&y=false&n=https%3A%2F%2Fthe-internet.herokuapp.com%2Fwindows&u=oeu1619157638780r0.2480523458768693&wxhr=true&t=1619157638784&f=298349752,318188263 - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1619157639748,
                "type": ""
            }
        ],
        "screenShotFile": "images\\009800e9-007a-00cd-0004-002700f100b6.png",
        "timestamp": 1619157627737,
        "duration": 33019
    },
    {
        "description": "Enter username|Interact with Frames",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5980,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.72"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "images\\003c0050-00ec-0061-003c-003200a400e2.png",
        "timestamp": 1619163900053,
        "duration": 15733
    },
    {
        "description": "switch to default content|Interact with Frames",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5980,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.72"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "images\\00be0032-006f-007f-00c2-0001008900b4.png",
        "timestamp": 1619163916379,
        "duration": 3872
    },
    {
        "description": "Switch to new window|Interact with Frames",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5980,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.72"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://298279967.log.optimizely.com/event?a=298279967&d=298279967&y=false&n=https%3A%2F%2Fthe-internet.herokuapp.com%2Fwindows&u=oeu1619163926485r0.1376624766733201&wxhr=true&t=1619163926489&f=298349752,318188263 - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1619163926709,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://298279967.log.optimizely.com/event?a=298279967&d=298279967&y=false&n=engagement&g=298283957&u=oeu1619163926485r0.1376624766733201&wxhr=true&t=1619163930582&f=298349752,318188263 - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1619163930599,
                "type": ""
            }
        ],
        "screenShotFile": "images\\00f60010-00a7-001a-00f8-001300b50082.png",
        "timestamp": 1619163920357,
        "duration": 13759
    },
    {
        "description": "Enter username|Interact with Frames",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11408,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.72"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "images\\00d4009d-0054-008b-00a3-00f400ea00c6.png",
        "timestamp": 1619164488226,
        "duration": 12482
    },
    {
        "description": "switch to default content|Interact with Frames",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11408,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.72"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "images\\0034004d-0079-00a5-005f-005f000b0094.png",
        "timestamp": 1619164501018,
        "duration": 3769
    },
    {
        "description": "Switch to new window|Interact with Frames",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11408,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.72"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://298279967.log.optimizely.com/event?a=298279967&d=298279967&y=false&n=https%3A%2F%2Fthe-internet.herokuapp.com%2Fwindows&u=oeu1619164510085r0.2686793801680052&wxhr=true&t=1619164510089&f=298349752,318188263 - Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
                "timestamp": 1619164510596,
                "type": ""
            }
        ],
        "screenShotFile": "images\\00610028-00a9-0080-0091-0015001700f6.png",
        "timestamp": 1619164504871,
        "duration": 15747
    }
];

    this.sortSpecs = function () {
        this.results = results.sort(function sortFunction(a, b) {
    if (a.sessionId < b.sessionId) return -1;else if (a.sessionId > b.sessionId) return 1;

    if (a.timestamp < b.timestamp) return -1;else if (a.timestamp > b.timestamp) return 1;

    return 0;
});

    };

    this.setTitle = function () {
        var title = $('.report-title').text();
        titleService.setTitle(title);
    };

    // is run after all test data has been prepared/loaded
    this.afterLoadingJobs = function () {
        this.sortSpecs();
        this.setTitle();
    };

    this.loadResultsViaAjax = function () {

        $http({
            url: './combined.json',
            method: 'GET'
        }).then(function (response) {
                var data = null;
                if (response && response.data) {
                    if (typeof response.data === 'object') {
                        data = response.data;
                    } else if (response.data[0] === '"') { //detect super escaped file (from circular json)
                        data = CircularJSON.parse(response.data); //the file is escaped in a weird way (with circular json)
                    } else {
                        data = JSON.parse(response.data);
                    }
                }
                if (data) {
                    results = data;
                    that.afterLoadingJobs();
                }
            },
            function (error) {
                console.error(error);
            });
    };


    if (clientDefaults.useAjax) {
        this.loadResultsViaAjax();
    } else {
        this.afterLoadingJobs();
    }

}]);

app.filter('bySearchSettings', function () {
    return function (items, searchSettings) {
        var filtered = [];
        if (!items) {
            return filtered; // to avoid crashing in where results might be empty
        }
        var prevItem = null;

        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            item.displaySpecName = false;

            var isHit = false; //is set to true if any of the search criteria matched
            countLogMessages(item); // modifies item contents

            var hasLog = searchSettings.withLog && item.browserLogs && item.browserLogs.length > 0;
            if (searchSettings.description === '' ||
                (item.description && item.description.toLowerCase().indexOf(searchSettings.description.toLowerCase()) > -1)) {

                if (searchSettings.passed && item.passed || hasLog) {
                    isHit = true;
                } else if (searchSettings.failed && !item.passed && !item.pending || hasLog) {
                    isHit = true;
                } else if (searchSettings.pending && item.pending || hasLog) {
                    isHit = true;
                }
            }
            if (isHit) {
                checkIfShouldDisplaySpecName(prevItem, item);

                filtered.push(item);
                prevItem = item;
            }
        }

        return filtered;
    };
});

//formats millseconds to h m s
app.filter('timeFormat', function () {
    return function (tr, fmt) {
        if(tr == null){
            return "NaN";
        }

        switch (fmt) {
            case 'h':
                var h = tr / 1000 / 60 / 60;
                return "".concat(h.toFixed(2)).concat("h");
            case 'm':
                var m = tr / 1000 / 60;
                return "".concat(m.toFixed(2)).concat("min");
            case 's' :
                var s = tr / 1000;
                return "".concat(s.toFixed(2)).concat("s");
            case 'hm':
            case 'h:m':
                var hmMt = tr / 1000 / 60;
                var hmHr = Math.trunc(hmMt / 60);
                var hmMr = hmMt - (hmHr * 60);
                if (fmt === 'h:m') {
                    return "".concat(hmHr).concat(":").concat(hmMr < 10 ? "0" : "").concat(Math.round(hmMr));
                }
                return "".concat(hmHr).concat("h ").concat(hmMr.toFixed(2)).concat("min");
            case 'hms':
            case 'h:m:s':
                var hmsS = tr / 1000;
                var hmsHr = Math.trunc(hmsS / 60 / 60);
                var hmsM = hmsS / 60;
                var hmsMr = Math.trunc(hmsM - hmsHr * 60);
                var hmsSo = hmsS - (hmsHr * 60 * 60) - (hmsMr*60);
                if (fmt === 'h:m:s') {
                    return "".concat(hmsHr).concat(":").concat(hmsMr < 10 ? "0" : "").concat(hmsMr).concat(":").concat(hmsSo < 10 ? "0" : "").concat(Math.round(hmsSo));
                }
                return "".concat(hmsHr).concat("h ").concat(hmsMr).concat("min ").concat(hmsSo.toFixed(2)).concat("s");
            case 'ms':
                var msS = tr / 1000;
                var msMr = Math.trunc(msS / 60);
                var msMs = msS - (msMr * 60);
                return "".concat(msMr).concat("min ").concat(msMs.toFixed(2)).concat("s");
        }

        return tr;
    };
});


function PbrStackModalController($scope, $rootScope) {
    var ctrl = this;
    ctrl.rootScope = $rootScope;
    ctrl.getParent = getParent;
    ctrl.getShortDescription = getShortDescription;
    ctrl.convertTimestamp = convertTimestamp;
    ctrl.isValueAnArray = isValueAnArray;
    ctrl.toggleSmartStackTraceHighlight = function () {
        var inv = !ctrl.rootScope.showSmartStackTraceHighlight;
        ctrl.rootScope.showSmartStackTraceHighlight = inv;
    };
    ctrl.applySmartHighlight = function (line) {
        if ($rootScope.showSmartStackTraceHighlight) {
            if (line.indexOf('node_modules') > -1) {
                return 'greyout';
            }
            if (line.indexOf('  at ') === -1) {
                return '';
            }

            return 'highlight';
        }
        return '';
    };
}


app.component('pbrStackModal', {
    templateUrl: "pbr-stack-modal.html",
    bindings: {
        index: '=',
        data: '='
    },
    controller: PbrStackModalController
});

function PbrScreenshotModalController($scope, $rootScope) {
    var ctrl = this;
    ctrl.rootScope = $rootScope;
    ctrl.getParent = getParent;
    ctrl.getShortDescription = getShortDescription;

    /**
     * Updates which modal is selected.
     */
    this.updateSelectedModal = function (event, index) {
        var key = event.key; //try to use non-deprecated key first https://developer.mozilla.org/de/docs/Web/API/KeyboardEvent/keyCode
        if (key == null) {
            var keyMap = {
                37: 'ArrowLeft',
                39: 'ArrowRight'
            };
            key = keyMap[event.keyCode]; //fallback to keycode
        }
        if (key === "ArrowLeft" && this.hasPrevious) {
            this.showHideModal(index, this.previous);
        } else if (key === "ArrowRight" && this.hasNext) {
            this.showHideModal(index, this.next);
        }
    };

    /**
     * Hides the modal with the #oldIndex and shows the modal with the #newIndex.
     */
    this.showHideModal = function (oldIndex, newIndex) {
        const modalName = '#imageModal';
        $(modalName + oldIndex).modal("hide");
        $(modalName + newIndex).modal("show");
    };

}

app.component('pbrScreenshotModal', {
    templateUrl: "pbr-screenshot-modal.html",
    bindings: {
        index: '=',
        data: '=',
        next: '=',
        previous: '=',
        hasNext: '=',
        hasPrevious: '='
    },
    controller: PbrScreenshotModalController
});

app.factory('TitleService', ['$document', function ($document) {
    return {
        setTitle: function (title) {
            $document[0].title = title;
        }
    };
}]);


app.run(
    function ($rootScope, $templateCache) {
        //make sure this option is on by default
        $rootScope.showSmartStackTraceHighlight = true;
        
  $templateCache.put('pbr-screenshot-modal.html',
    '<div class="modal" id="imageModal{{$ctrl.index}}" tabindex="-1" role="dialog"\n' +
    '     aria-labelledby="imageModalLabel{{$ctrl.index}}" ng-keydown="$ctrl.updateSelectedModal($event,$ctrl.index)">\n' +
    '    <div class="modal-dialog modal-lg m-screenhot-modal" role="document">\n' +
    '        <div class="modal-content">\n' +
    '            <div class="modal-header">\n' +
    '                <button type="button" class="close" data-dismiss="modal" aria-label="Close">\n' +
    '                    <span aria-hidden="true">&times;</span>\n' +
    '                </button>\n' +
    '                <h6 class="modal-title" id="imageModalLabelP{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getParent($ctrl.data.description)}}</h6>\n' +
    '                <h5 class="modal-title" id="imageModalLabel{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getShortDescription($ctrl.data.description)}}</h5>\n' +
    '            </div>\n' +
    '            <div class="modal-body">\n' +
    '                <img class="screenshotImage" ng-src="{{$ctrl.data.screenShotFile}}">\n' +
    '            </div>\n' +
    '            <div class="modal-footer">\n' +
    '                <div class="pull-left">\n' +
    '                    <button ng-disabled="!$ctrl.hasPrevious" class="btn btn-default btn-previous" data-dismiss="modal"\n' +
    '                            data-toggle="modal" data-target="#imageModal{{$ctrl.previous}}">\n' +
    '                        Prev\n' +
    '                    </button>\n' +
    '                    <button ng-disabled="!$ctrl.hasNext" class="btn btn-default btn-next"\n' +
    '                            data-dismiss="modal" data-toggle="modal"\n' +
    '                            data-target="#imageModal{{$ctrl.next}}">\n' +
    '                        Next\n' +
    '                    </button>\n' +
    '                </div>\n' +
    '                <a class="btn btn-primary" href="{{$ctrl.data.screenShotFile}}" target="_blank">\n' +
    '                    Open Image in New Tab\n' +
    '                    <span class="glyphicon glyphicon-new-window" aria-hidden="true"></span>\n' +
    '                </a>\n' +
    '                <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>\n' +
    '            </div>\n' +
    '        </div>\n' +
    '    </div>\n' +
    '</div>\n' +
     ''
  );

  $templateCache.put('pbr-stack-modal.html',
    '<div class="modal" id="modal{{$ctrl.index}}" tabindex="-1" role="dialog"\n' +
    '     aria-labelledby="stackModalLabel{{$ctrl.index}}">\n' +
    '    <div class="modal-dialog modal-lg m-stack-modal" role="document">\n' +
    '        <div class="modal-content">\n' +
    '            <div class="modal-header">\n' +
    '                <button type="button" class="close" data-dismiss="modal" aria-label="Close">\n' +
    '                    <span aria-hidden="true">&times;</span>\n' +
    '                </button>\n' +
    '                <h6 class="modal-title" id="stackModalLabelP{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getParent($ctrl.data.description)}}</h6>\n' +
    '                <h5 class="modal-title" id="stackModalLabel{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getShortDescription($ctrl.data.description)}}</h5>\n' +
    '            </div>\n' +
    '            <div class="modal-body">\n' +
    '                <div ng-if="$ctrl.data.trace.length > 0">\n' +
    '                    <div ng-if="$ctrl.isValueAnArray($ctrl.data.trace)">\n' +
    '                        <pre class="logContainer" ng-repeat="trace in $ctrl.data.trace track by $index"><div ng-class="$ctrl.applySmartHighlight(line)" ng-repeat="line in trace.split(\'\\n\') track by $index">{{line}}</div></pre>\n' +
    '                    </div>\n' +
    '                    <div ng-if="!$ctrl.isValueAnArray($ctrl.data.trace)">\n' +
    '                        <pre class="logContainer"><div ng-class="$ctrl.applySmartHighlight(line)" ng-repeat="line in $ctrl.data.trace.split(\'\\n\') track by $index">{{line}}</div></pre>\n' +
    '                    </div>\n' +
    '                </div>\n' +
    '                <div ng-if="$ctrl.data.browserLogs.length > 0">\n' +
    '                    <h5 class="modal-title">\n' +
    '                        Browser logs:\n' +
    '                    </h5>\n' +
    '                    <pre class="logContainer"><div class="browserLogItem"\n' +
    '                                                   ng-repeat="logError in $ctrl.data.browserLogs track by $index"><div><span class="label browserLogLabel label-default"\n' +
    '                                                                                                                             ng-class="{\'label-danger\': logError.level===\'SEVERE\', \'label-warning\': logError.level===\'WARNING\'}">{{logError.level}}</span><span class="label label-default">{{$ctrl.convertTimestamp(logError.timestamp)}}</span><div ng-repeat="messageLine in logError.message.split(\'\\\\n\') track by $index">{{ messageLine }}</div></div></div></pre>\n' +
    '                </div>\n' +
    '            </div>\n' +
    '            <div class="modal-footer">\n' +
    '                <button class="btn btn-default"\n' +
    '                        ng-class="{active: $ctrl.rootScope.showSmartStackTraceHighlight}"\n' +
    '                        ng-click="$ctrl.toggleSmartStackTraceHighlight()">\n' +
    '                    <span class="glyphicon glyphicon-education black"></span> Smart Stack Trace\n' +
    '                </button>\n' +
    '                <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>\n' +
    '            </div>\n' +
    '        </div>\n' +
    '    </div>\n' +
    '</div>\n' +
     ''
  );

    });
