describe('adaptive design flow', () => {
  it('uploads data and gets next design', () => {
    cy.visit('/projects/00000000-0000-0000-0000-000000000000/adaptive');
    const data = [
      { condition: 'A', outcome: 1 },
      { condition: 'B', outcome: 0 }
    ];
    cy.get('input[type=file]').selectFile({
      contents: JSON.stringify(data),
      fileName: 'data.json',
      mimeType: 'application/json'
    }, { force: true });
    cy.contains('Next Step').click();
    cy.contains('Next Design');
  });
});
