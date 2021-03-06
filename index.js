var cors = require('cors')
var express = require('express')
var pg = require('pg')

var db_conf = {
  user: 'dnd_site',
  database: 'dnd',
  password: 'dungeons',
  host: 'localhost',
  port: 5432,
  max: 25,
}

var app = express()
app.use(cors({origin:['http://dnd.dsierra.io', 'http://dsierra.io', 'http://localhost:4200']}))

var pool = new pg.Pool(db_conf)

// QUERIES

const SELECT_ALL_CLASSES = 'SELECT (id) FROM classes'
const GET_CLASS_ATTRIBUTES = 'SELECT name FROM classes WHERE id=$1::int'
const SELECT_ALL_SPELLS = 'SELECT (id) FROM spells'
const SEARCH_SPELLS = ' SELECT id, name FROM spells WHERE name ILIKE $1 ORDER BY name'
const GET_SPELL_ATTRIBUTES = 'SELECT name, type, casting_time, range, components, duration, primary_description, level FROM spells WHERE id=$1::int'
const LEVELS_CLASS_GETS_SPELLS = 'SELECT DISTINCT (level) FROM class_spells WHERE class=$1::int ORDER BY level'
const SPELLS_AT_LEVEL_FOR_CLASS_ID = 'SELECT class_spells.spell,spells.name FROM class_spells INNER JOIN spells ON spells.id=class_spells.spell WHERE class=$1::int AND class_spells.level=$2::int ORDER BY spells.name'
const SPELLS_UPTO_LEVEL_FOR_CLASS_ID = 'SELECT class_spells.spell,spells.name FROM class_spells INNER JOIN spells ON spells.id=class_spells.spell WHERE class=$1::int AND class_spells.level<=$2::int ORDER BY spells.name'
const SELECT_ALL_USERS = 'SELECT (name) FROM users'
const FIND_USER = 'SELECT id, name, spells FROM users where name ILIKE $1 LIMIT 1'
const SAVE_USER = 'INSERT INTO users (name, spells) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET spells = excluded.spells'

// SQL

function doQuery(query, params, cb) {
  
  pool.connect(function(err, client, done) {

    if(err) {
      console.log(err)
    }
    
    client.query(query, params, function(err, result) {
     
      if(err) {
        console.log(err)
      }

      done()
      
      cb(result.rows)
    })
  })
}

function getClasses(cb) {
  
  var classes = []
  
  doQuery(SELECT_ALL_CLASSES, [], function(results) {
    
    for(var i in results) {
      
      classes.push(results[i].id)
    }
    
    cb(classes)
  })
}

function getClassAttributes(classId, cb) {
  
  var attributes = {}
  
  doQuery(GET_CLASS_ATTRIBUTES, [classId], function(results) {
    
    for(var i in results) {
      
      attributes = {
        name : results[i].name
      }
    }
    
    cb(attributes, classId)
  })
}

function getSpellLevelsWithClassId(classId, cb) {
  
  var levels = []
  
  doQuery(LEVELS_CLASS_GETS_SPELLS, [classId], function(results) {
    
    for(var i in results) {
      
      levels.push(results[i].level)
    }
    
    cb(levels)
  })
}

function getLevelSpellsForClassId(classId, level, cb) {
  
  var spellList = []
  
  doQuery(SPELLS_AT_LEVEL_FOR_CLASS_ID, [classId, level], function(results) {

    for(var i in results) {
      
      spellList.push(results[i].spell)
    }
    
    cb(spellList)
  })
}

function getUptoLevelSpellsForClassId(classId, level, cb) {
  
  var spellList = []
  
  doQuery(SPELLS_UPTO_LEVEL_FOR_CLASS_ID, [classId, level], function(results) {
    
    for(var i in results) {
      
      spellList.push(results[i].spell)
    }
    
    cb(spellList)
  })
}

function getSpells(cb) {
  
  var spells = []
  
  doQuery(SELECT_ALL_SPELLS, [], function(results) {
    
    for(var i in results) {
      
      spells.push(results[i].id)
    }
    
    cb(spells)
  })
}

function searchSpells(query, anywhere, cb) {

  var spells = []
  
  if(query === null) {
    
    cb(spells)
    return
  }
  
  query = query + '%'
  
  if(anywhere) {
    
    query = '%' + query
  }

  doQuery(SEARCH_SPELLS, [query], (results) => {

    for(var i in results) {

      spells.push({
        id: results[i].id,
        name: results[i].name
      })
    }
    
    cb(spells)
  })
}

function getSpellAttributes(spellId, cb) {
  
  var attributes = {}
  
  doQuery(GET_SPELL_ATTRIBUTES, [spellId], function(results) {
    
    for(var i in results) {
      
      attributes = {
        name : results[i].name,
        type : results[i].type,
        casting_time : results[i].casting_time,
        range : results[i].range,
        components : results[i].components,
        duration : results[i].duration,
        primary_description : results[i].primary_description,
        level : results[i].level,
      }
    }
    
    cb(attributes)
  })
}

function findUsers(cb) {
  
  var users = []
  
  doQuery(SELECT_ALL_USERS, [], function(results) {
    
    for(var i in results) {
      
      users.push(results[i].name)
    }
    
    cb(users)
  })
}

function findUser(name, cb) {
  
  var user = {}
  
  doQuery(FIND_USER, [name], function(results) {
    
    if(results.length === 1) {

      user.id = results[0].id
      user.name = results[0].name
      var spells = results[0].spells
      user.spells = spells ? spells.split(',') : []
    }
    
    cb(user)
  })
}

function saveUser(name, spells, cb) {
  
  doQuery(SAVE_USER, [name, spells], function(results) {
    
    cb({name, spells})
  })
}

// HTTP
// All requests return valid data assuming a valid input
// Invalid data will result in an empty object/array being returned

app.get('/classes', function(req, res) {

  getClasses(function(results) {
    
    res.json(results)
  })
})

app.get('/spells', function(req, res) {
  
  getSpells(function(results) {
    res.json(results)
  })
})

app.get('/classes/all', function(req, res) {
  
  var classes = {}
  
  getClasses(function(results) {
    
    var count = results.length
    
    for(var i in results) {
     
      getClassAttributes(results[i], function(attribs, id) {
        
        classes[id] = attribs
        
        // make sure all async calls are done
        if(!--count) {
          
          res.json(classes)
        }
      })
    }
  })
})

app.get('/classes/all2', function(req, res) {

  var classes = []

  getClasses(function(results) {

    var count = results.length

    for(var i in results) {

      getClassAttributes(results[i], function(attribs, id) {

        attribs.id = id
        classes.push(attribs)

        // make sure all async calls are done
        if(!--count) {

          res.json(classes)
        }
      })
    }
  })
})

app.get('/classes/:class', function(req, res) {
  
  var clazz = req.params.class
  
  if(clazz.match(/^\d+$/)) {
    
    getClassAttributes(clazz, function(results) {
      
      res.json(results)
    })
  } else {
    
    res.json({})
  }
})

app.get('/spells/search', (req, res) => {

  var query = req.query.q || null
  var anywhere = req.query.anywhere === '1' ? true : false

  searchSpells(query, anywhere, (results) => {

    res.json(results)
  })
})

app.get('/spells/:spell', function(req, res) {
  
  var spell = req.params.spell
  
  if(spell.match(/^\d+$/)) {
    
    getSpellAttributes(spell, function(results) {
      
      res.json(results)
    })
  } else {
    
    res.json({})
  }
})

app.get('/classes/:class/spells', function(req, res) {
  
  var clazz = req.params.class
  
  if(clazz.match(/^\d+$/)) {
    
    getSpellLevelsWithClassId(clazz, function(results) {
      
      res.json(results)
    })
  } else {
    
    res.json({})
  }
})

app.get('/classes/:class/spells/:level', function(req, res) {
  
  var clazz = req.params.class
  var level = req.params.level
  
  if(clazz.match(/^\d+$/) && level.match(/^\d+$/)) {
    
    getLevelSpellsForClassId(clazz, level, function(results) {
      
      res.json(results)
    })
  } else {
    
    res.json({})
  }
})

app.get('/classes/:class/spells/:level/upto', function(req, res) {
  
  var clazz = req.params.class
  var level = req.params.level
  
  if(clazz.match(/^\d+$/) && level.match(/^\d+$/)) {
    
    getUptoLevelSpellsForClassId(clazz, level, function(results) {
      
      res.json(results)
    })
  } else {
    
    res.json({})
  }
})

app.get('/users', (req, res) => {
  
  if(user !== null) {

    findUsers((results) => {
      
      res.json(results)
    })
  } else {
    
    res.json({})
  }
})

app.get('/users/:user', (req, res) => {

  var user = req.params.user || null

  if(user !== null) {

    findUser(user, (userObj) => {
    
      res.json(userObj)
    })
  } else {
    
    res.json({})
  }
})

app.post('/users/:user', (req, res) => {
  
  var user = req.params.user || null

  saveUser(user, "[]", (result) => {
    res.json(result)
  })
})

app.post('/users/:user/spells/:spell', (req, res) => {

  var user = req.params.user || null
  var spell = req.params.spell
  
  if(!spell.match(/^\d+$/) || user === null) {
    res.json({})
    return
  }

  spell = parseInt(spell)
  
  findUser(user, (userObj) => {
  
    if(userObj.id) {
      
      var spells = []
      
      if(userObj.spells) {
        spells = JSON.parse(userObj.spells)
      }
      
      var i = spells.indexOf(spell)
      
      if(i === -1) {
        spells.push(spell)
      }

      saveUser(userObj.name, JSON.stringify(spells), (result) => {
        res.json(result)
      })
    } else {
      
      res.json({})
    }
  })
})

app.delete('/users/:user/spells/:spell', (req, res) => {

  var user = req.params.user || null
  var spell = req.params.spell
  
  if(!spell.match(/^\d+$/) || user === null) {
    res.json({})
    return
  }

  spell = parseInt(spell)
  
  findUser(user, (userObj) => {
  
    if(userObj.id) {
      
      var spells = []
      
      if(userObj.spells) {
        spells = JSON.parse(userObj.spells)
      }
      
      var i = spells.indexOf(spell)
      
      if(i !== -1) {
        spells.splice(i ,1)
      }

      saveUser(userObj.name, JSON.stringify(spells), (result) => {
        res.json(result)
      })
    } else {
      
      res.json({})
    }
  })
})

app.listen(3000)
