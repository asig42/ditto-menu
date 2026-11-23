const allowedCategories = new Set(['food','bottle','glass','highball','cocktail']);
const allowedStates = new Set(['public','soldout','hidden','draft']);
const allowedGroups = new Set(['warm','cold','desserts']);

function validContent(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const limits = {name:90,english:90,price:40,detail:350,englishDetail:350};
  return Object.keys(value).every(key => key in limits)
    && Object.entries(limits).every(([key, limit]) => value[key] === undefined
      ? key !== 'name'
      : typeof value[key] === 'string' && value[key].length <= limit)
    && value.name.trim().length > 0;
}
function validRecords(rows) {
  return Array.isArray(rows) && rows.length <= 300
    && new Set(rows.map(row => row?.id)).size === rows.length
    && rows.every(row => row && typeof row.id === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(row.id)
      && allowedCategories.has(row.category) && allowedStates.has(row.state)
      && Object.keys(row).every(key => ['id','category','state','live','draft','group'].includes(key))
      && (row.group === undefined || row.group === '' || (row.category === 'food' && allowedGroups.has(row.group)))
      && (row.live === undefined || validContent(row.live))
      && (row.draft === undefined || validContent(row.draft))
      && (row.state === 'draft' ? validContent(row.draft) : validContent(row.live)));
}
function isAllowedUser(token, emails) {
  return token.email_verified === true && token.firebase?.sign_in_provider === 'google.com'
    && typeof token.email === 'string' && emails.has(token.email.toLowerCase());
}
function publicRecords(rows) {
  return rows.filter(row => row.state === 'public' || row.state === 'soldout')
    .map(({id,category,state,live,group}) => (group ? {id,category,state,live,group} : {id,category,state,live}));
}
module.exports = {validRecords,isAllowedUser,publicRecords};
