const utils = require('./utils');
const range = utils.range;
const deepcopy = utils.deepcopy;

module.exports.Capacity = class {
	constructor(json, owner){
        // ID des deux joueurs
		this.owner = owner;

		this.target = (json['target']) ? json['target'] : null;
        this.target_label = this.target;
        this.condition = (json['condition']) ? json['condition'] : "none";
        this.need_winner = false;
        if ((json['condition'] !== undefined)) {
            if (['victoire', 'defaite'].includes(json['condition'])) {
                this.need_winner = true;
            }
        }
        this.modification = (json['modification']) ? json['modification'] : "null";
        this.cost = (json['cost']) ? json['cost'] : false;
        this.cost_type = (json['cost_type']) ? json['cost_type'] : "null";
        this.cost_value = (json['cost_value']) ? json['cost_value'] : 0;
        this.cost_paid = false;
        this.effect = (json['effect']) ? effets[json['effect']] : null;
        this.priority = (json['effect'] == 'stop_talent') ? true : false;
        this.value = (json['value']) ? json['value'] : 0;
        this.contrecoup = (json['contrecoup']) ? json['contrecoup'] : false;
        this.need_choice = (['recuperation', 'oppression',
            'pillage'].includes(json['effect']) || this.cost);
        this.choice_made = false;
        this.choices = [];
        this.stopped = false;
        this.data = json;
        this.done = false;
	}

    execute_capacity(turn) {
    	let o = this.owner;
        let p = o.get_played_prodigy().name;
        let msg = p + ' applique : ' + this.get_string_effect(turn);
	    if (this.check_condition(o)
            && !this.stopped
            && this.available_targets()) {
	        if (this.cost && !this.cost_paid) {
                let state = {'label': 'paying_cost',
                    'value': this.cost_value,
                    'cost_type': this.cost_type,
                    'capacity': this};
                return state;
	        }
            if (this.need_choice
                && this.choices.length != this.value
                && this.available_targets()) {
                let state = {'label': 'waiting_choice',
                    'value': this.cost_value,
                    'capacity': this,
                    'target_zone': this.get_target_zone()};
                return state;
            }
            this.owner.socket.emit('text_log', msg);
            players[this.owner.opp].socket.emit('text_log', msg);

            this.set_target();
            this.value *= this.get_modification(turn);
            return this.effect(this);
	    }
        return false;
	}

    get_target_zone(){
        let e = this.data.effect;
        if (this.data.cost_type == 'glyph' && !this.cost_paid){
            return 'hand_glyphes';
        } else {
            if (['oppression', 'pillage'].includes(e)) {
                return 'hand_glyphes';
            } else if (e == 'recuperation') {
                return 'empty_voie';
            } 
        }
    }

    available_targets() {
        let opp = players[this.owner.opp];
        let own = this.owner;
        let targets = 0;
        if (this.data.cost_type == 'glyph' && !this.cost_paid){
            // Si le coût n'a pas encore été payé
            for (let glyph of this.owner.hand) {
                if (glyph > 0) {
                    targets++;
                }
            }
            return (targets - this.choices.length >= this.cost_value);
        } else {
            // Si le coût a été payé mais qu'il faut quand même une cible
            if (this.data.effect == 'recuperation') {
                let value = this.value;
                for (let element in own.played_glyphs) {
                    if (own.played_glyphs[element] > 0) {
                        targets++;
                    }
                }
                return (targets - this.choices.length >= this.value);
            } else if (['oppression', 'pillage'].includes(this.data.effect)) {
                let value = this.value;
                for (let glyph of opp.hand) {
                    if (glyph > 0) {
                        targets++;
                    }
                }
                return (targets - this.choices.length >= this.value);
            }
        }
        return true;
    }

	set_target() {
	    // Target definition;
	    let c = this.contrecoup;
	    let t = this.target;
	    let own = this.owner;
        let opp = players[own.opp];
	    if (t == "opp") {
	        this.target = (c) ? own : opp;
            this.target_label = (c) ? 'own' : 'opp';
	    }
	    else if (t == "owner") {
	        this.target = (c) ? opp : own;
            this.target_label = (c) ? 'opp' : 'own';
	    }
	}

	check_condition(owner) {
	    let victoire = this.condition == "victoire" && owner.winner;
	    let defaite = this.condition == "defaite" && !owner.winner;
	    let courage = this.condition == "courage" && owner.order == 0;
	    let riposte = this.condition == "riposte" && owner.order == 1;
	    let none = this.condition == "none";
	    if (victoire || defaite || courage || riposte || none) {
	        return true;
	    } else {
	        return false;
	    }
	}

	get_modification(turn) {
        let owner = this.owner;
	    if (this.modification == "patience") {
	        return turn;
	    } else if (this.modification == "acharnement") {
	        return 3 - turn;
	    } else if (this.modification == "par_glyphe") {
	        let count = 0;
	        for (element in owner.played_glyphs) {
	        	glyph = owner.played_glyphs[element];
	            if (glyph == 0) {
	                count = count + 1;
	            }
	        }
	        return count;
	    } else {
	        return 1;
	    }
	}

	get_string_effect(turn) {
	    let string = "";
	    let d = this.data;
	    string = (!d['contrecoup']) ? string : string + "Contrecoup" + " ";
	    if (d['cost']) {
	        string = string + d['cost_value'] + " " + d['cost_type'] + " ";
	    }
	    string = (!d['condition']) ? string : string + d['condition'] + " ";
	    string = (!d['modification']) ? string : string + d['modification'] + " ";
	    string = string +  d['effect'] + " ";
        let modif = this.get_modification(turn);
	    string = (!d['value']) ? string : string + parseInt(d['value']) * modif;
	    return string;
	}
}

var effets = {};

effets['recuperation'] = function(capa) {
    debugger;
    let v = capa.value;
    let t = capa.target;
    let choices = capa.choices;
    for (let c of choices) {
        t.hand.push(parseInt(c.value));
        t.played_glyphs[c.element] = -1;
    }
    return {
        'label': 'recuperation',
        'choices': capa.choices,
        'status': 'done',
		'target': capa.target_label,
        'owner': capa.owner.socket.id
    }
}


effets['modif_degats'] = function(capa) {
    let p = capa.target.get_played_prodigy();
    let v = capa.value;
    p.degats = (p.protected && v < 0) ? p.degats : p.degats + v;
    return {
        'label': 'modif_degats',
        'value': capa.value,
        'status': 'done',
		'target': capa.target_label,
		'owner': capa.owner.socket.id
    }
}


effets['modif_puissance'] = function(capa) {
    let p = capa.target.get_played_prodigy();
    let v = capa.value;
    p.puissance = (p.protected && v < 0) ? p.puissance : p.puissance + v;
    return {
        'label': 'modif_puissance',
        'value': capa.value,
        'status': 'done',
		'target': capa.target_label,
		'owner': capa.owner.socket.id
    }
}


effets['modif_puissance_degats'] = function(capa) {
    effets['modif_puissance'](capa);
    effets['modif_degats'](capa);
    return {
        'label': 'modif_puissance_degats',
        'value': capa.value,
        'status': 'done',
		'target': capa.target_label,
		'owner': capa.owner.socket.id
    }
}


effets['modif_hp'] = function(capa) {
    let p = capa.target;
    p.hp = p.hp + capa.value;
    return {
        'label': 'modif_hp',
        'value': capa.value,
        'status': 'done',
		'target': capa.target_label,
		'owner': capa.owner.socket.id
    }
}


effets['stop_talent'] = function(capa) {
    let p = capa.target.get_played_prodigy();
    if (!p.protected) {
        p.talent.stopped = true;
    }
    return {
        'label': 'stop_talent',
        'status': 'done',
		'target': capa.target_label,
		'owner': capa.owner.socket.id
    }
}


effets['stop_maitrise'] = function(capa) {
    let p = capa.target.get_played_prodigy();
    if (!p.protected) {
        p.maitrise.stopped = true;
    }
    return {
        'label': 'stop_maitrise',
        'status': 'done',
		'target': capa.target_label,
		'owner': capa.owner.socket.id
    }
}


effets['protection'] = function(capa) {
    capa.target.get_played_prodigy().protected = true;
    return {
        'label': 'protection',
        'status': 'done',
		'target': capa.target_label,
		'owner': capa.owner.socket.id
    }
}


effets['echange_p'] = function(capa) {
    let p1 = capa.target.get_played_prodigy();
    let p2 = capa.target.opp.get_played_prodigy();
    let bp1 = p1.base_puissance;
    let bp2 = p2.base_puissance;
    p1.base_puissance = bp2;
    p1.puissance = p1.puissance - bp1 + bp2;
    p2.base_puissance = bp1;
    p2.puissance = p2.puissance - bp2 + bp1;
    return {
        'label': 'echange_p',
        'status': 'done',
        'values' : [p1.puissance, p2.puissance],
		'target': capa.target_label,
		'owner': capa.owner.socket.id
    }
}


effets['echange_d'] = function(capa) {
    let d1 = capa.target.get_played_prodigy();
    let d2 = capa.target.opp.get_played_prodigy();
    let bd1 = p1.base_degats;
    let bd2 = p2.base_degats;
    d1.base_degats = bd2;
    d1.degats = d1.degats - bd1 + bd2;
    d2.base_degats = bp1;
    d2.degats = d2.degats - bd2 + bd1;
    return {
        'label': 'echange_p',
        'status': 'done',
        'values' : [p1.degats, p2.degats],
        'target': capa.target_label,
		'owner': capa.owner.socket.id
    }
}


effets['copy_talent'] = function(capa) {
    let t = capa.target.get_played_prodigy().talent;
    let clone = {...t};
    clone.owner = t.opp;
    clone.opp = t.owner;
    let json = clone.data;
    clone.target = (json['target']) ? json['target'] : null;
    clone.execute_capacity();
    return {
        'label': 'copy_talent',
        'status': 'done',
		'target': capa.target_label,
		'owner': capa.owner.socket.id
    }
}


effets['copy_maitrise'] = function(capa) {
    let t = capa.target.get_played_prodigy().maitrise;
    let clone = {...t};
    clone.owner = t.opp;
    clone.opp = t.owner;
    let json = clone.data;
    clone.target = (json['target']) ? json['target'] : null;
    clone.execute_capacity();
    return {
        'label': 'copy_maitrise',
        'status': 'done',
		'target': capa.target_label,
		'owner': capa.owner.socket.id
    }
}


effets['oppression'] = function(capa) {
    let v = capa.value;
    let t = capa.target;
    let l = t.hand.length;
    let count = 0;
    for (let i of range(0, l)) {
        if (count == v) {
            break;
        }
        let index = l - i - 1;
        // TODO: demander défausse à l'adversaire
        if (t.hand[index] != 0) {
            t.hand.splice(index, 1);
            count = count + 1;
        }
    }
    return {
        'label': 'oppression',
        'choices': capa.choices,
        'status': 'done',
		'target': capa.target_label,
		'owner': capa.owner.socket.id
    }
}


effets['pillage'] = function(capa) {
    let v = capa.value;
    let t = capa.target;
    let l = t.hand.length;
    let count = 0;
    for (let i of range(0, l)) {
        if (count == v) {
            break;
        }
        let index = l - i - 1;
        // TODO: demander défause à l'adversaire
        if (t.hand[index] != 0) {
            t.opp.hand = t.opp.hand + [t.hand[index]];
            t.hand.splice(index, 1);
            count = count + 1;
        }
    }
    return {
        'label': 'pillage',
        'choices': capa.choices,
        'status': 'done',
		'target': capa.target_label,
		'owner': capa.owner.socket.id
    }
}


effets['initiative'] = function(capa) {
    capa.target.get_played_prodigy().initiative = true;
    return {
        'label': 'initiative',
        'status': 'done',
		'target': capa.target_label,
		'owner': capa.owner.socket.id
    }
}


effets['avantage'] = function(capa) {
    capa.target.get_played_prodigy().advantaged = true;
    return {
        'label': 'avantage',
        'status': 'done',
		'target': capa.target_label,
		'owner': capa.owner.socket.id
    }
}


effets['vampirism'] = function(capa) {
    let v = capa.value;
    let t = capa.target;
    t.hp = t.hp - v;
    t.opp.hp = t.opp.hp + v;
    return {
        'label': 'vampirism',
        'value': v,
        'status': 'done',
		'target': capa.target_label,
		'owner': capa.owner.socket.id
    }
}


effets['regard'] = function(capa) {
    capa.target.has_regard = true;
    return {
        'label': 'vampirism',
        'status': 'done',
		'target': capa.target_label,
		'owner': capa.owner.socket.id
    }
}


effets['nothing'] = function(capa) {
    return {
        'label': 'nothing',
        'status': 'done',
		'target': capa.target_label,
		'owner': capa.owner.socket.id
    }
}