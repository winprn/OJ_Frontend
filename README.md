# FrontEnd part for LHPOJ

# How to use
Firstly, you'll need to install **npm, yarn** and **npx**.\
Clone this repo, then open a terminal in this directory.\
Run ``yarn install``\
Next, run ``npx hydrooj addon add '@hydrooj/ui-default'``\
Run ``yarn build:watch`` to enable the backend.
Run ``yarn build:ui:dev`` to enable the frontend.
Lastly, you need to run ``yarn debug --port=2333`` to connect to the database with the details given in discord server.\
After first run, re-run ``yarn build:watch, yarn build:ui:dev, yarn debug --port=2333`` and the website is available at localhost:8000

Note: you must keep those three command running from 3 diffenrent terminals/command prompts.

----

## If you want to modify a page
Get the component's name by viewing the source of the page you want to change\
Take notice of the ```data-type="<component>"``` in the second line of the source\
Go to ```packages/ui-default/addon/templates/``` and find the .html has that ``<component>`` in it's name then edit it.

## If you want to modify the translation
Go to ```packages/ui-default/addon/locales/``` and open the .yaml file you want to change.

**Make sure to follow the format**
