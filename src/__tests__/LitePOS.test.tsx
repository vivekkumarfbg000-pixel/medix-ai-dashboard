import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AlternativeDialog } from '../components/pos/AlternativeDialog';

describe('LitePOS: Alternative Medicine Dialog Integration Suite', () => {
  const mockOptions = [
    {
      id: 'sub-1',
      medicine_name: 'Paracetamol Pro 650mg',
      unit_price: 15.0,
      purchase_price: 9.0,
      composition: 'Paracetamol 650mg',
      stock_status: 'in_stock',
    },
    {
      id: 'sub-2',
      medicine_name: 'Calpol High Margin 650mg',
      unit_price: 18.0,
      purchase_price: 10.0,
      composition: 'Paracetamol 650mg',
      stock_status: 'in_stock',
    }
  ];

  it('should not render anything when data is null', () => {
    const handleClose = vi.fn();
    const handleSelect = vi.fn();
    const { container } = render(
      <AlternativeDialog data={null} onClose={handleClose} onSelect={handleSelect} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should render dialog headers and recommended substitutes cleanly', () => {
    const handleClose = vi.fn();
    const handleSelect = vi.fn();
    const data = {
      itemId: 'med-original',
      name: 'Crocin 650mg',
      options: mockOptions,
    };

    render(
      <AlternativeDialog data={data} onClose={handleClose} onSelect={handleSelect} />
    );

    // Verify dialog title renders
    expect(screen.getByText('Recommended Substitutes')).toBeInTheDocument();
    
    // Verify descriptive text matches target medicine
    expect(screen.getByText(/Crocin 650mg/i)).toBeInTheDocument();

    // Verify option names render
    expect(screen.getByText('Paracetamol Pro 650mg')).toBeInTheDocument();
    expect(screen.getByText('Calpol High Margin 650mg')).toBeInTheDocument();
  });

  it('should trigger onSelect handler when clicking an alternative item', () => {
    const handleClose = vi.fn();
    const handleSelect = vi.fn();
    const data = {
      itemId: 'med-original',
      name: 'Crocin 650mg',
      options: mockOptions,
    };

    render(
      <AlternativeDialog data={data} onClose={handleClose} onSelect={handleSelect} />
    );

    const firstOption = screen.getByText('Paracetamol Pro 650mg');
    fireEvent.click(firstOption);

    // Verify callback triggers with original id and selected alternative object
    expect(handleSelect).toHaveBeenCalledTimes(1);
    expect(handleSelect).toHaveBeenCalledWith('med-original', mockOptions[0]);
  });

  it('should display fallback message if options list is empty', () => {
    const handleClose = vi.fn();
    const handleSelect = vi.fn();
    const data = {
      itemId: 'med-original',
      name: 'Crocin 650mg',
      options: [],
    };

    render(
      <AlternativeDialog data={data} onClose={handleClose} onSelect={handleSelect} />
    );

    expect(screen.getByText('No higher margin substitutes found in inventory.')).toBeInTheDocument();
  });
});
