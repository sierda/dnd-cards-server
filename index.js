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
var pool = new pg.Pool(db_conf)

// QUERIES

const SELECT_ALL_CLASSES = "SELECT (id) FROM classes"
const GET_CLASS_ATTRIBUTES = "SELECT name FROM classes where id=$1::int";
const SELECT_ALL_SPELLS = "SELECT (id) FROM spells";
const GET_SPELL_ATTRIBUTES = "SELECT name, type, casting_time, range, components, duration, primary_description, level FROM spells where id=$1::int";
const LEVELS_CLASS_GETS_SPELLS = "SELECT DISTINCT (level) from class_spells where class=$1::int order by level";
const SPELLS_AT_LEVEL_FOR_CLASS_ID = "select class_spells.spell,spells.name from class_spells inner join spells on spells.id=class_spells.spell where class=$1::int and class_spells.level=$2::int order by spells.name";
const SPELLS_UPTO_LEVEL_FOR_CLASS_ID = "select class_spells.spell,spells.name from class_spells inner join spells on spells.id=class_spells.spell where class=$1::int and class_spells.level<=$2::int order by spells.name";

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

app.listen(3000)
