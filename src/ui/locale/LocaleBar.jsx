import React from 'react'
import LanguagePicker from './LanguagePicker.jsx'
import CurrencyPicker from './CurrencyPicker.jsx'
import { cx } from '../kit.jsx'

/** The two pickers side by side — what the storefront header and admin topbar use. */
export function LocaleBar({ compact = false, align = 'right', tone = 'dark', className }) {
  return (
    <div className={cx('flex items-center gap-1.5', className)}>
      <LanguagePicker compact={compact} align={align} tone={tone} />
      <CurrencyPicker compact={compact} align={align} tone={tone} />
    </div>
  )
}

export default LocaleBar
