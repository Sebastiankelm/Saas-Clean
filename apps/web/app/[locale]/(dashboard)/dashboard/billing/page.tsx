'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@saas-clean/ui';
import { Button } from '@saas-clean/ui';
import { Download, ExternalLink, Loader2 } from 'lucide-react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type Invoice = {
  id: string;
  number: string | null;
  status: string;
  amountDue: number;
  amountPaid: number;
  currency: string;
  billingReason: string | null;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
};

type InvoicesResponse = {
  invoices: Invoice[];
};

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function getStatusBadge(status: string) {
  const statusMap: Record<string, { label: string; className: string }> = {
    paid: { label: 'Paid', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
    open: { label: 'Open', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' },
    uncollectible: { label: 'Uncollectible', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' },
    void: { label: 'Void', className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
    DKK: { label: 'Draft', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' },
  };

  const statusInfo = statusMap[status] || { label: status, className: 'bg-gray-100 text-gray-800' };

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${statusInfo.className}`}>
      {statusInfo.label}
    </span>
  );
}

export default function BillingPage() {
  const { data, error, isLoading } = useSWR<InvoicesResponse>('/api/invoices', fetcher);

  if (isLoading) {
    return (
      <section className="flex-1 bg-white p-4 dark:bg-gray-950 lg:p-8">
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="flex-1 bg-white p-4 dark:bg-gray-950 lg:p-8">
        <div className="rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-900 dark:text-red-200">
          Failed to load invoices. Please try again later.
        </div>
      </section>
    );
  }

  const invoices = data?.invoices || [];

  return (
    <section className="flex-1 bg-white p-4 dark:bg-gray-950 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Billing & Invoices</h1>
        <p className="text-sm text-muted-foreground mt-1">
          View and download your invoices
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invoice History</CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No invoices found. Invoices will appear here after you make your first payment.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                      Invoice #
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                      Period
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr
                      key={invoice.id}
                      className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900"
                    >
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        {invoice.number || `inv_${invoice.id.slice(0, 10)}`}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {new Date(invoice.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {invoice.periodStart && invoice.periodEnd
                          ? `${new Date(invoice.periodStart).toLocaleDateString()} - ${new Date(invoice.periodEnd).toLocaleDateString()}`
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                        {formatAmount(invoice.amountDue, invoice.currency)}
                      </td>
                      <td className="px-4 py-3 text-sm">{getStatusBadge(invoice.status)}</td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex space-x-2">
                          {invoice.hostedInvoiceUrl && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(invoice.hostedInvoiceUrl!, '_blank')}
                              className="rounded-full"
                            >
                              <ExternalLink className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          )}
                          {invoice.invoicePdf && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(invoice.invoicePdf!, '_blank')}
                              className="rounded-full"
                            >
                              <Download className="h-4 w-4 mr-1" />
                              PDF
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

