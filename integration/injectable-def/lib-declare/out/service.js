"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var core_1 = require("@angular/core");
var module_1 = require("./module");
var Service = /** @class */ (function () {
    function Service() {
        this.instance = Service.instances++;
    }
    Service.instances = 0;
    Service.decorators = [
        { type: core_1.Injectable, args: [{
                    scope: module_1.ServiceModule,
                },] },
    ];
    /** @nocollapse */
    Service.ctorParameters = function () { return []; };
    return Service;
}());
exports.Service = Service;
