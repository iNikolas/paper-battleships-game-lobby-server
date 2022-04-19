## Getting started

0. Go to your service account settings `https://console.firebase.google.com/project/{your-project-name}/settings/serviceaccounts/adminsdk` and grab your `service account key` by pressing `Generate new private key` button.

1. Save the aforementioned file in the root folder of your project.

2. In the root folder create `.env` file and add next content to it:

```sh
NODE_ENV=development
GOOGLE_APPLICATION_CREDENTIALS=C:\project\path\serviceAccountKey.json
```
3. Install dependencies:

```sh
npm i
```

4. Run [Redis](https://redis.io/) server locally. You can install `Redis` on Windows by means of [Windows Subsystem for Linux (WSL)](https://docs.microsoft.com/en-us/windows/wsl/install).

5. Run the project:

```sh
nodemon index
```

6. Start [Front-End part](https://github.com/iNikolas/paper-battleships-firebase-client) of the project to test its functionality.

## How to deploy my app to Heroku?

1. Create new [Heroku app](https://dashboard.heroku.com/apps).

2. Create a new Git repository

```sh
git init
heroku git:remote -a project-name
```

3. Deploy your application

```sh
git add .
git commit -am "make it better"
git push heroku master
```

4. Add `Heroku Redis` as application add-on at the Resources tab `https://dashboard.heroku.com/apps/{project-name}/resources`

5. Go to `Settings` tab and press `Reveal Config Vars` button.

6. Set your Config vars according to the following pattern

```sh
NODE_ENV=production
GOOGLE_APPLICATION_CREDENTIALS=serviceAccountKey.json
```