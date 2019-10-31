# Website for the SNiC: SingularIT 2018 congress

## Setup
Install [Docker](https://docs.docker.com/engine/installation/) and [Docker Compose](https://docs.docker.com/compose/install/).

### Running for development
Run the following to build the development image:
```bash
./docker-compose-dev.sh build
```

And run it with:
```bash
./docker-compose-dev.sh up
```

This container has the `singularIT` directory mounted as a volume, so you don't have
to rebuild the container on every change. It will also automatically reload
when files have changed using `nodemon`.

### Running in production
Build the image with:

```bash
docker-compose build
```

And run it (detached) with
```
docker-compose up -d
```

## Credits
This framework was started by [Arian van Putten](https://github.com/arianvp), extended and improved upon by [Dennis Collaris](https://github.com/iamDecode). It however does not show up as a fork due to the need temporarily have the repository private.

## Config

Configuration files are not included in this repository. You will need to add a file named `config.json` to the root folder with the following structure:
```javascript
{
  "mongodb": {
    // When using the provided docker-compose file, this is fine. Otherwise change address. Port is optional
    // You can optionally set username and pass using URI: mongodb://user:password@localhost/SNiC
    "url": "mongodb://mongodb/SNiC"
  },

  "mailchimp": {
    "id": "id of the list can be found on the page of defaults of the list. Lists > DisruptIT > Settings > List name and campaign defaults > ListID on page (don't take form URL",
    "key": "Generate this yourself at your account page"
  },
  "mailgun":{
      "domain": "Domain you provided or the sandbox url",
      "api_key": "Mention on the information page of the domain"
  },

  "email": {
    // Not unified because this allows for easier use when implementing mailchimp
    "auth": {
      "user": "default SMTP login on the domain page",
      "pass": "default password on the domain page"
    }
  },
  "session": {
    // Session secret. Should be better when running in production.
    "secret": "abc123"
  },
  // Used to create the very first ticket.
  "starthelper": {
      "active": false,
      "url": "url"
  },
  // List of associations that take part.
  // List used to create the dropdown options when registering, therefore partner
  // bus indicates whether or not that association gets a bus
  "verenigingen": [
    {
      "name": "Cover",
      "bus": true
    },
    {
      "name": "A-eskwadraat",
      "bus": true
    },
    {
      "name": "CognAC",
      "bus": true
    },
    {
      "name": "De Leidsche Flesch",
      "bus": true
    },
    {
      "name": "GEWIS",
      "bus": true
    },
    {
      "name": "Inter-Actief",
      "bus": true
    },
    {
      "name": "Sticky",
      "bus": true
    },
    {
      "name": "Thalia",
      "bus": true
    },
    {
      "name": "via",
      "bus": true
    },
    {
      "name": "Partner",
      "bus": false
    }
  ],
  "studyProgrammes": [
    "BSc Computer Science",
    "BSc Artificial Intelligence",
    "BSc Information Sciences",
    "BSc Mathematics"
  ],
  "ticketSaleStarts": "2015-08-01T00:00:00.001Z", // From when to register
  "providePreferences": false,     // If people can signup for sessions.
  "hideMenu": false,               // Not used in disruptIT
  // Used for matching
  // Choices are automatically generated based on order of this list.
  // Works although the order is not guaranteed by JSON standard.
  "matchingterms": [
    "Programmer",
    "Code witcher"
  ]
}
```

The speaker.json is used to generate the speaker page and for the enrollment tool. It is is structered in the following way

```javascript
{
  "tracks": ["Grand Technical Challenges", "Societal Impact", "Experience the Singularity"],
  "showTrackNames": false,
  "showHosts": false,
  "speakerids": {
    "session1": ["kuipers"],
    "session2": ["kuipers"],
    "session3": ["kuipers"],
    "opening": "robert",
    "closing": "robert"
  },
  "speakers": [
    {
      "name": "Dr. André Kuipers",
      "id": "kuipers",
      "image": "/images/speakers/Kuipers.jpg",
      "subject": "",
      "company": "",
      "talk": [
        ""
      ],
      "bio": [
        "<i>Astronaut & Ambassador of Earth.</i>",
        "André Kuipers is the first Dutchman with two space missions to his name. His second mission is the longest spaceflight in European history. In total the ESA astronaut spent 204 days in space: 11 days during mission DELTA in 2004 and 193 days during mission PromISSe.",
        "After years of training in Houston, Moscow, Cologne, Montreal and Tokyo, a Russian Soyuz spaceship launched André and his two crew members from Russia and America on the 21st of December 2011 from Kazakhstan. Two days later he arrived at the International Space Station to live and work for six months. On board he was not only a medical doctor, scientist and flight engineer, but also handyman and ambassador for several charities. On the 1st of July 2012, André returned to Earth and landed in his space capsule in the Kazakh steppe. ",
        "Astronaut André Kuipers offers a unique look behind the scenes of international human spaceflight. He shares his story about the training, the mission and his exceptional view of our planet. "
      ],
      "limit": null,
      "hidden": false
    }
  ],
  "presenters": [
    {
      "name": "Robert Belleman",
      "id": "robert",
      "company": "",
      "bio": [
        "Robert Belleman, PhD, is a lecturer/researcher at the Informatics Institute and program director for the Bachelor Informatica (undergraduate Computer Science) at the University of Amsterdam. His research interests include scientific visualization, computer graphics and virtual/augmented reality. He teaches courses on the same subjects at the graduate and undergraduate level."
      ],
      "image": "/images/sprekers/robert.png",
      "hidden": false
    }
  ]
}



```

The timetable.json is used to create the timetable and is used in both the website and the app. 
```javascript
{
  "date": "2019-11-26T",
  "startTime": "10:00:00.000Z",
  "endTime": "17:15:00.000Z",
  "timeInterval": 15,
  "tracks": [
    {
      "trackId": "track 1",
      "name": "track 1",
      "location": "first location",
      "talks": [
        {
          "id": 0,
          "startTime": "12:00:00.000Z",
          "endTime": "14:00:00.000Z",
          "capacity": 5,
          "enabled": true,
          "title": "Talk 1",
          "subTitle": "First talk first talk first talk first talk first talk. Another sentence, with a comma. Third sentence, without a comma (I lied).",
          "speakerId": "PJ"
        },
        {
          "id": 1,
          "startTime": "15:00:00.000Z",
          "endTime": "16:00:00.000Z",
          "capacity": 20,
          "enabled": true,
          "location": "Override location 1",
          "title": "Talk 2",
          "subTitle": "Second talk",
          "speakerId": "PJ"
        }
      ]
    },
    {
      "trackId": "track 2",
      "name": "track 2",
      "location": "second location",
      "talks": [
        {
          "id": 2,
          "startTime": "11:00:00.000Z",
          "endTime": "14:00:00.000Z",
          "capacity": 35,
          "enabled": true,
          "title": "Talk 1.1",
          "subTitle": "First talk of second track",
          "speakerId": "PJ"
        },
        {
          "id": 3,
          "startTime": "14:00:00.000Z",
          "endTime": "16:00:00.000Z",
          "capacity": 25,
          "enabled": true,
          "title": "Talk 2.1",
          "subTitle": "Second talk of second track",
          "speakerId": "PJ"
        }
      ]
    },
    {
      "trackId": "track 3",
      "name": "track 3",
      "location": "third location",
      "talks": [
        {
          "id": 4,
          "startTime": "11:00:00.000Z",
          "endTime": "12:00:00.000Z",
          "capacity": 9,
          "enabled": true,
          "location": "Room 3",
          "title": "Talk 1.2",
          "subTitle": "First talk of third track",
          "speakerId": "kuipers"
        },
        {
          "id": 5,
          "startTime": "12:00:00.000Z",
          "endTime": "13:00:00.000Z",
          "capacity": 45,
          "enabled": true,
          "location": "Override location 3",
          "title": "Talk 2.2",
          "subTitle": "Second talk of third track",
          "speakerId": "PJ"
        }
      ]
    }
  ]
}



```

# Reload
After editing or replacing the .json files, run `/reload` to reload all of them. If you only changed 1 of the files, use `/reload/filename`, E.G `/reload/timetable` or `/reload/speakers`.

# Creating an admin user
The easiest way is to log in to mongo-express and change the boolean of a user to true

# Generating tickets

To generate tickets run `node generate-tickets.js <number-of-tickets>'`. To produce tickets non-default types, run `node generate-tickets.js <number-of-tickets> partner', where partner is the type of the ticket.
