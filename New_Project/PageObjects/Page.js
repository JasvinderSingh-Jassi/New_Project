/**
 * Created by Jasvinder Singh on 31st March 2021
 * Description - Verifies the Iframe and Window Handling functionality
 */

"use strict";
let Page = function () {

  this.username = element(by.id("username"));
  this.header = element(by.tagName("h1"));
  this.clickhere = element(by.linkText("Click Here"));
  
};

module.exports = new Page();