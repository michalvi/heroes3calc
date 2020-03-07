import React from 'react';
import style from './Bank.css';

export class Bank extends React.Component {

  render() {
    props = this.props;
    return (
      <div className={style.bank}>
        <img src={props.image} alt={props.name} onClick={() => props.onClick()}/>
      </div>
    );
  }
}

