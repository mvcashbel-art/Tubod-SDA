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

## Good to know

- **Members** sign in with a username and password they choose when they join. Admins can make other members admins, set a new password for someone, or remove a member (gear icon, Manage members).
- **Photos and library files** are saved in the Drive folder "Tubod SDA Church files" and use your Google Drive space. Library files can be up to 15 MB each.
- **New posts** show up for others within about 20 seconds.
- **Forgot the admin password?** In Apps Script, open `resetPasswordFromEditor`, type your username and a new password on the two lines near the top, and run it.
- **Changing Code.gs later?** After editing, click **Deploy > Manage deployments**, then the pencil icon, choose **New version**, and **Deploy**. The web app link stays the same.
- **Keep the Google Sheet private.** It holds member names and sign-in details. Do not share it with anyone you do not fully trust.
