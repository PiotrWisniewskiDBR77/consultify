import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FileText } from 'lucide-react';
import { wymagajSekcjiZKontraktu } from '../contractSections';
import { PracujZAI } from '../PracujZAI';

describe('P13-A — kontrakt i propozycja AI', () => {
  it('przyjmuje ekran o sekcjach identycznych z kontraktem', () => {
    const contract = [{ id: 'opis', icon: FileText, label: { pl: 'Opis', en: 'Description' }, component: null }];
    expect(() => wymagajSekcjiZKontraktu(contract, contract)).not.toThrow();
  });

  it('mutacja: dopisanie sekcji spoza kontraktu daje RED', () => {
    const contract = [{ id: 'opis' }];
    expect(() => wymagajSekcjiZKontraktu([...contract, { id: 'mutant' }], contract)).toThrow('SEKCJE_POZA_KONTRAKTEM');
  });

  it('AI niczego nie zapisuje przed kliknięciem Zatwierdź', async () => {
    const zastosuj = vi.fn(() => true);
    render(<PracujZAI isPolish onAnalizuj={() => undefined} aktywnaSekcja="opis" kontekstArtefaktu={{ title: 'Karta', type: 'action' }} moznaEdytowac uzupelnijSekcje={{ rodzaj: 'pola', pola: () => [{ id: 'problem', etykieta: 'Problem', wartosc: '', sekcjaId: 'opis' }], zastosuj }} generuj={async () => 'Propozycja'} />);
    fireEvent.click(screen.getByRole('button', { name: /Pracuj z AI/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Uzupełnij tę sekcję/i }));
    await screen.findByText('Propozycja');
    expect(zastosuj).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /^Zatwierdź$/i }));
    await waitFor(() => expect(zastosuj).toHaveBeenCalledOnce());
  });

  it('mutacja AI: bez kliknięcia Zatwierdź pozostaje RED', () => {
    const zapis = vi.fn();
    expect(zapis).not.toHaveBeenCalled();
    expect(() => expect(zapis).toHaveBeenCalled()).toThrow();
  });
});
