//Accessing the variables from Page.js
let Page = require('../PageObjects/Page');

describe('Interact with Frames', () => {

    beforeAll(async () => {

        await browser.waitForAngularEnabled(false);

        //Maximize the browser window
        browser.manage().window().maximize();
    })

    //Accessing Iframe
    it('Enter username', async () => {

        //Accessing URL
        await browser.get('https://play.letcode.in/frame')

        //Switching to frame
        await browser.switchTo().frame(0);
        await Page.username.sendKeys("admin");
    });

    //Accessing Default Content
    it('switch to default content', async () => {

        //Accessing URL
        await browser.get('https://play.letcode.in/frame')

        //Switching to default content
        await browser.switchTo().defaultContent();

        let header = await Page.header.getText();

        //Print header
        console.log("The header is: "+header);

    })

    //Window Handle
    it('Switch to new window', async () => {

        //Accessing URL
        await browser.get('https://the-internet.herokuapp.com/windows');

        //Printing title of window
        console.log("The title of window is: "+await browser.getTitle());
        await Page.clickhere.click();
        let wins = await browser.getAllWindowHandles();

        //Printing the window handles
        console.log("The window handles are: "+wins);

        //Printing the no of windows
        console.log("The no of window handles are: "+wins.length);

        //Switch to second window
        await browser.switchTo().window(wins[1]);

        //Print title of second window
        console.log("Title of second window is: "+await browser.getTitle());
        console.log("Branch1");

    })

    afterEach(async () => {
        await browser.sleep(3000);
    })
});