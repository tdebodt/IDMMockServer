module.exports = {
  port: process.env.PORT || 3333,
  issuer: process.env.ISSUER || 'https://idmmock.semantical.cc',
  defaults: {
    sub: 'mock-user-001',
    rrn: '85073100145',
    given_name: 'Jan',
    family_name: 'Peeters',
    roles: [
      'DienstenchequesErkendeOnderneming-50042:0456765432'
    ]
  }
};
