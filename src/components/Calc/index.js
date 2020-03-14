import React from 'react';
import Immutable from 'immutable';
import style from './Calc.css';
import applib from "../../app-lib";
import {TITLES} from '../../data.js';
import {memoize} from "../../immutable-lib";
import {AttackResult} from '../AttackResult/index.js';
import {Creatures, asyncGetBanks, asyncGetCreatureData} from '../Creatures/index.js';
import {Features} from '../Features/index.js';
import {RetaliationResult} from '../RetaliationResult/index.js';

const emptyForm = memoize(applib.emptyForm);
const stateUpdate = memoize(applib.stateUpdate);

function featuresEqual(lhs, rhs) {
  if (lhs === undefined && rhs === undefined)
    return true;

  if (lhs === undefined || rhs === undefined)
    return false;

  return Immutable.is(lhs.attacking, rhs.attacking) && Immutable.is(lhs.defending, rhs.defending);
}

function dispatchStateUpdate(state, features, features_type) {
  if (features_type === 'attacking') {
    return stateUpdate(features, state.defending);
  } else {
    return stateUpdate(state.attacking, features);
  }
}

export class Calc extends React.Component {

  constructor(props) {
    super(props);
    this.banks = undefined;
    this.state = Object.assign(
      {
        toggle: 'attacking',
        history: Immutable.List(),
        future: Immutable.List(),
      },
      stateUpdate(emptyForm(), emptyForm()),
    );
    this.goBack = this.goBack.bind(this);
    this.goForward = this.goForward.bind(this);
    this.handleSwap = this.handleSwap.bind(this);
    this.creature_data = undefined;
    const creature_data_promise = asyncGetCreatureData();
    creature_data_promise.then(creature_data => { this.creature_data = creature_data; });
    const banks_promise = asyncGetBanks(creature_data_promise.then(creature_data => creature_data.by_name));
    banks_promise.then((banks) => {
      console.log(banks.map(x => x.toJS()));
      this.banks = banks;
      this.forceUpdate();
    })
  }

  handleSwap() {
    this.setState(state => {
      const current = {attacking: state.attacking, defending: state.defending};
      const last = state.history.last();
      if (!featuresEqual(current, last)) {
        state.history = state.history.push(Object.freeze(current));
        state.future = Immutable.List();
      }
      const attacking = state.attacking;
      const defending = state.defending;
      return Object.assign(state, stateUpdate(defending, attacking));
    });
  }

  /// features_type: {attacking,defending}
  handleInputChange(features_type, input_name, parsed_value) {
    this.setState(state => {
      const creature_data = this.creature_data;
      let features = state[features_type];
      features = features.set(input_name, parsed_value);
      const current = {attacking: state.attacking, defending: state.defending};
      const last = state.history.last();
      if (input_name === 'name' && creature_data && creature_data.hasCreature(parsed_value)) {
        if (!featuresEqual(current, last)) {
          state.history = state.history.push(Object.freeze(current));
          state.future = Immutable.List();
        }
      } else {
        state.history = state.history.update(state.history.size - 1, () => current);
      }
      return Object.assign(state, dispatchStateUpdate(state, features, features_type));
    });
  }

  onGuardClick(guard) {
    const creature = guard.get('creature')
    this.handleCreatureClick(creature);
    // TODO: set guard.number in the features.amount
  }

  handleCreatureClick(creature) {
    this.setState(state => {
      const features_type = state.toggle;
      let features = state[features_type];
      features = features.merge(creature);
      const current = {attacking: state.attacking, defending: state.defending};
      const last = state.history.last();
      if (!featuresEqual(current, last)) {
        state.history = state.history.push(Object.freeze(current));
        state.future = Immutable.List();
      }

      return Object.assign(state, dispatchStateUpdate(state, features, features_type));
    });
  }

  handleFeaturesClick(type) {
    this.setState({toggle: type});
  }

  static saveCurrent(state, previous) {
    const current = {
      attacking: state.attacking,
      defending: state.defending
    };

    return featuresEqual(current, previous.last()) ?
        previous : previous.push(Object.freeze(current));
  }

  static moveZipper(state, previous, next) {
    if (next.size === 0)
      return state;

    return [Calc.saveCurrent(state, previous), next.last(), next.pop()];
  }

  goBack() {
    this.setState(state => {
      let [previous, middle, next] = Calc.moveZipper(state, state.future, state.history);
      state.history = next;
      state.future = previous;
      return Object.assign(state, middle);
    });
  }

  goForward() {
    this.setState(state => {
      let [previous, middle, next] = Calc.moveZipper(state, state.history, state.future);
      state.history = previous;
      state.future = next;
      return Object.assign(state, middle);
    });
  }

  render() {
    const state = this.state;
    const attacking_active = state.toggle === 'attacking';
    const defending_active = state.toggle === 'defending';
    const attacking = state.attacking;
    const attacking_name = attacking.get('name');
    const attacking_damage_average = attacking.getIn(['damage', 'average']);
    const attacking_losses_average = attacking.getIn(['losses', 'average']);
    const defending = state.defending;
    const defending_name = defending.get('name');
    const defending_damage_average = defending.getIn(['damage', 'average']);
    const defending_losses_average = defending.getIn(['losses', 'average']);
    const banks = this.banks;
    const creature_data = this.creature_data;
    return (
      <div className={style.calc}>
        <div className={style['attack-result']}>
          <h3>{TITLES.attacking}</h3>
          <AttackResult attacking={attacking}/>
        </div>
        <div className={style['retaliation-result']}>
          <h3>{TITLES.defending}</h3>
          <RetaliationResult defending={defending} />
        </div>
        <div className={style.tips}>
          <h3>Tips</h3>
          <div style={{padding: 16.38 + 'px'}}>
            <p>Archery: add 2, 5, or 10 to the Additional Attack field.</p>
            <p>Offense: add 2, 4, or 6 to the Additional Attack field.</p>
            <p>Armorer: put the value (5, 10, or 15) in the Damage Reduction field.</p>
          </div>
        </div>
        <Interactions
            goBack={this.goBack}
            goForward={this.goForward}
            handleSwap={this.handleSwap}
        />
        <div className={style.attacking}>
          <Features type="attacking"
                    values={attacking}
                    active={attacking_active}
                    onInputChange={(...xs) => this.handleInputChange(...xs)}
                    onClick={type => this.handleFeaturesClick(type)}
                    onCreatureChange={creature => this.handleCreatureClick(creature)}
                    creature_data={creature_data}
          />
        </div>
        <div className={style.dummy}/>
        <div className={style.defending}>
          <Features type="defending"
                    values={defending}
                    active={defending_active}
                    onInputChange={(...xs) => this.handleInputChange(...xs)}
                    onClick={type => this.handleFeaturesClick(type)}
                    onCreatureChange={creature => this.handleCreatureClick(creature)}
                    creature_data={creature_data}
          />
        </div>
        <div className={style.creatures}>
          <Creatures banks={banks} onGuardClick={guard => this.onGuardClick(guard)}/>
        </div>
        <div className={style['fight-logs']}>
          The {attacking_name}s do {attacking_damage_average} damage.
          {' '}{defending_losses_average} {defending_name}s perish.<br/>
          The {defending_name}s do {defending_damage_average} damage.
          {' '}{attacking_losses_average} {attacking_name}s perish.<br/>
          History: {state.history.size}<br/>
          Future: {state.future.size}<br/>
        </div>
      </div>
    );
  }
}

function Interactions(props) {
  const goForward = props.goForward;
  const goBack = props.goBack;
  const handleSwap = props.handleSwap;
  return (
    <div className={style.interactions}>
      <button className={`${style.interaction} ${style.noselect}`}
              onClick={goBack}>🠄</button>
      <button className={`${style.interaction} ${style.noselect}`}
              onClick={handleSwap}>⇄</button>
      <button className={`${style.interaction} ${style.noselect}`}
              onClick={goForward}>🠆</button>
    </div>
  );
}
