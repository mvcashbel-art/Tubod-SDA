# Tubod SDA Church website: setup

You need these files. Upload all of them to GitHub except `Code.gs`, which goes into Google Sheets: `index.html`, `config.js`, `manifest.json`, `icon-192.png`, `icon-512.png`, `og-image.jpg` and `Code.gs`. Allow about 20 minutes. Do the steps in order.

## Part 1: The Google Sheet (this stores everything)

1. Go to sheets.google.com and create a **Blank spreadsheet**. Name it "Tubod SDA Church".
2. Click **Extensions > Apps Script**.
3. Delete the code that is already there. Open `Code.gs`, copy all of it, and paste it in. Click the save icon.
4. In the toolbar, pick the function **setup** and click **Run**.
5. Google asks for permission. Click **Review permissions**, choose your account, click **Advanced**, then **Go to (project name) (unsafe)**, then **Allow**. This is your own script, so it is safe.
6. Wait for "Execution completed". The sheet now has tabs (Members, Posts, and so on) and your Google Drive has a folder called "Tubod SDA Church files".
7. Click **Deploy > New deployment**. Click the gear icon and choose **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
8. Click **Deploy** and copy the **Web app URL**. It ends with `/exec`.

## Part 2: GitHub (this shows the website)

1. On github.com, click **New repository**. Name it, for example, `Tubod-SDA`. Make it **Public**.
2. Click **Add file > Upload files** and upload `index.html`, `config.js`, `manifest.json`, `icon-192.png`, `icon-512.png` and `og-image.jpg`. Click **Commit changes**.
3. Click `config.js`, click the pencil icon, and replace `PASTE_YOUR_WEB_APP_LINK_HERE` with the Web app URL from Part 1. Click **Commit changes**.
4. Go to **Settings > Pages**. Under Branch choose **main** and **/ (root)**, then **Save**.
5. After about a minute, GitHub shows your site address, like `https://your-name.github.io/Tubod-SDA/`.

## Part 3: First use

1. Open your site and click **Join the church page**. Use the join code **TUBODSDA**. **The first person to join becomes the admin, so do this yourself before sharing the link.**
2. Click the gear icon. Change the join code, add the Sabbath schedule and verse of the week, and upload your church photo as the background.
3. Share the site link and the join code with your church family, for example in your Messenger group chat.

## Sharing on Messenger and Facebook

- **Put the link in your church Messenger group chat** and pin it. When you paste the site address, Messenger shows a picture card with the church name. If your GitHub name or repository name is different from `mvcashbel-art` and `Tubod-SDA`, open `index.html` on GitHub and change the two web addresses near the top (`og:url` and `og:image`) so the picture appears.
- **Share an announcement:** on the Announcements page, tap **Share** under a message. On a phone this opens the share sheet, where you pick Messenger, Facebook or Messages. **Copy** is the backup.
- **Invite someone:** tap **Share the page** on the Home screen sidebar, or **Invite family** on the Members page. As an admin, the invite also includes the join code.
- **If the link opens inside Messenger**, tap the menu (three dots) and choose **Open in browser**, so members stay signed in.
- **Keep it like an app:** on the phone, open the browser menu and choose **Add to Home screen**. The church icon then sits with the other apps.
- Facebook remembers old link pictures. If the picture is missing or old, paste the address into Facebook's Sharing Debugger (developers.facebook.com/tools/debug) and press **Scrape Again**.

## Worship times, reminders and the worship program

- **Worship times:** click the gear icon. Under **Worship times**, set each worship (name, day, start time). Wednesday and Friday at 7:00 PM are already there. Use **Add a worship time** for more, and the X to remove one. The nearest worship always shows in the blue bar at the very top of every page, and in the sidebar.
- **Automatic announcements:** tick **Announce each worship automatically** and choose how many hours before. The site then posts an announcement like "Wednesday worship today at 7:00 PM. Everyone is welcome to join us." by itself. Old reminders delete themselves after 3 days.
  - **Turn this on once:** in Apps Script, choose the function **installTriggers** and click **Run**. Allow the permissions. After that it checks every hour.
  - If you have automatic texts (Semaphore) set up, tick **Also text members when it is posted** to text the reminder too. In free mode it only posts the announcement.
- **Worship program (roles and participants):** as an admin, tap **Add participants** under the nearest worship in the sidebar, or **Edit participants** next to the announcement box. Choose the worship, then fill in the name next to each role. The roles start in your order: presider or worship leader, opening song, song leader, welcome song for shaking hands, opening prayer, special song, message or speaker, prayer band, closing song, closing prayer. You can change a role, add more rows, remove rows, and move rows up or down. **Copy from last time** brings back the last program for that worship.
- **Announce it:** tap **Save and announce** to save the program and post the announcement in one step. Members then see the participants inside the announcement and in the sidebar. Only rows with a name are shown to members. The automatic reminders also show the program, and texts and Share include it.
- If you typed your worship times into the old text box, clear it, because the times now come from the list. That box is now **More about worship (optional)**.

## Text alerts (SMS)

**How it works**
- A member opens **My profile > Edit profile**, types their mobile number, ticks **Text me church announcements**, and saves. Only church leaders can see numbers.
- When an admin sends an announcement, there is a box **Also text members**. Tick it before pressing **Send**. Under any older announcement, an admin can also tap **Text members**.

**Free mode (this is the default, nothing to set up)**
After you send, a box shows the message and the numbers. Tap **Open text app** to send from your own phone, or **Copy** the message and numbers. This uses your own load, so it is a good way to try a few texts first. Tap **Show numbers** under the announcement to open the list again.

**Automatic mode with Semaphore (optional, costs money)**
1. Create an account at semaphore.co and copy your **API key**.
2. In Apps Script, click the gear icon (**Project Settings**), scroll to **Script properties**, and add:
   - `SMS_PROVIDER` = `SEMAPHORE`
   - `SEMAPHORE_API_KEY` = your key
   - `SEMAPHORE_SENDER` = your approved sender name (optional)
3. To test, add `TEST_NUMBER` = your own number (like `09171234567`), choose the function **sendTestSms**, and click **Run**. You should get one text.
4. After that, **Also text members** sends automatically. The box shows about how many text credits it will use. Semaphore charges one credit for each 160 characters per person, and texts here are cut at 320 characters. Check Semaphore's site for the current price.

**Upgrading from an earlier version**
1. In Apps Script, replace all of `Code.gs` with the new one and save.
2. Choose **setup** and click **Run** once (it only adds new columns and tabs and the Wednesday and Friday worship times).
   Then choose **installTriggers** and click **Run** once, to turn on the worship announcements.
3. Click **Deploy > Manage deployments**, the pencil icon, **Version: New version**, then **Deploy**. The web app link stays the same.
4. Upload the new `index.html` to GitHub.

## Making someone an admin

- **The first person to join is the admin automatically.** If that was you, you already are.
- **An admin can make others admins:** gear icon, **Manage members**, **Make admin**.
- **If someone else joined first, or you need to fix it from the sheet:** in Apps Script, open the function **makeAdminFromEditor**, replace `your-username` with your exact username (see the Members tab in the sheet), choose that function and click **Run**. Then sign out and sign in again on the website.

## Good to know

- **Members** sign in with a username and password they choose when they join. Admins can make other members admins, set a new password for someone, or remove a member (gear icon, Manage members).
- **Photos and library files** are saved in the Drive folder "Tubod SDA Church files" and use your Google Drive space. Library files can be up to 15 MB each.
- **New posts** show up for others within about 20 seconds.
- **Forgot the admin password?** In Apps Script, open `resetPasswordFromEditor`, type your username and a new password on the two lines near the top, and run it.
- **Changing Code.gs later?** After editing, click **Deploy > Manage deployments**, then the pencil icon, choose **New version**, and **Deploy**. The web app link stays the same.
- **Keep the Google Sheet private.** It holds member names and sign-in details. Do not share it with anyone you do not fully trust.

## Keeping the church's information safe (please read before anyone helps with the files)

The website files on GitHub (`index.html`, `config.js`, `sw.js` and the logos) are only the look of the site. They are meant to be public, and anyone can read them in their browser. That is normal and safe: the files hold no member information. All the church's information lives in the Google Sheet, and the site only shows it to someone after they sign in, so a copy of the files on its own shows an empty sign-in page.

So that this stays true, whoever helps you must follow these rules:

- **Never put the Google Sheet, or any copy or export of it, on GitHub.** Not the sheet, not a CSV file, not a screenshot of the member list. GitHub is public. The sheet belongs only in your own Google Drive.
- **Never put the downloaded member list (the CSV from "Download member list") on GitHub or any public place.** It holds names, status and baptism details. Keep it on your own computer or Drive. Under the Data Privacy Act, a person's religion is sensitive personal information.
- **Keep the join code off the files.** Share it in person or in your Messenger group, not inside any file you upload.
- **If you ever think the web app link (`/exec` in `config.js`) has leaked**, make a new deployment in Apps Script (Deploy > New deployment), put the new link in `config.js`, and the old link stops working.
