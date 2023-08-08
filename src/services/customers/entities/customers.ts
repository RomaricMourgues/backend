import config from "config";
import _ from "lodash";

export const CustomersTableName = "customers";
export const CustomersIndexes = ["id_email", "id_phone", "id"];

export default class Customers {
  public id: string;
  public id_email: string;
  public id_phone: string;

  public created_at: number;
  public locations: Locations[];

  public mfas: MFA[];
  public identity: Identity;
  public address: Address;
  public company: Company | null;
  public preferences: Preferences;

  public role: "USER" | "DISABLED" | "SYSADMIN" | "SYSAGENT";
  public configuration: Configuration;
}

type Locations = {
  country_code: string;
  latitude: number;
  longitude: number;
  created_at: number;
  updated_at: number;
};

type MFA = {
  id: string;
  type: "email" | "phone" | "app" | "password";
  value: string;
};

export type Identity = {
  version_id: string; //Contain a hash of the identity information sha256 of ordered content -> base64
  first_name: string;
  last_name: string;
  date_of_birth: string; //"1996-12-30";
  nationality: string;
  additional_nationalities: string[];
};

export type Address = {
  version_id: string; //Contain a hash of the address information sha256 of ordered content -> base64
  address_line_1: string;
  address_line_2: string;
  region: string;
  zip: string;
  country: string;
  city: string;
};

type Company = {
  version_id: string; //Contain a hash of the address information sha256 of ordered content -> base64
  //Display information
  name: string;
  logo: string;
  //Legal information
  legal_name: string;
  registration_number: string;
  tax_number: string;
  //Address
  address_line_1: string;
  address_line_2: string;
  region: string;
  country: string;
  zip: string;
  city: string;
};

type Preferences = {
  avatar?: string;
  language?: string;
  currency?: string;
};

type Configuration = {
  //Return defaults if not specifically set
  limits?: {
    withdrawals: {
      auto_validated_amount: number;
      minimal_amount: number;
    };
    deposits: {
      address_verification_threshold: number;
      identity_verification_threshold: number;
    };
  };
  fees?: {
    transfers: {
      relative: number;
      static: number;
    };
    transfers_currency_conversion: {
      relative: number;
      static: number;
    };
    withdrawals: {
      relative: number;
      static: number;
    };
    visa_payments: {
      relative: number;
      static: number;
    };
    ip_payments: {
      relative: number;
      static: number;
    };
  };
};

export const getConfigurationUnitToCurrency = (
  value: number,
  currency: string
) => {
  if (["usd", "eur", "gdp"].includes(currency)) {
    return value;
  }
  throw new Error("Configuration unit conversion not implemented");
};

export const getConfiguration = (
  configuration: Configuration
): Configuration => {
  return {
    limits: {
      withdrawals: {
        auto_validated_amount: 1000,
        minimal_amount: 25,
        ...configuration.limits?.withdrawals,
      },
      deposits: {
        address_verification_threshold: 1000,
        identity_verification_threshold: 0,
      },
    },
    fees: {
      transfers_currency_conversion: {
        relative:
          parseFloat(
            config.get<string>("general.default_enforced_final_amount_fees")
          ) || 0.07,
        static: 0,
        ...configuration.fees?.transfers,
      },
      transfers: {
        relative: 0,
        static: 0,
        ...configuration.fees?.transfers,
      },
      withdrawals: {
        relative: 0,
        static: 3,
        ...configuration.fees?.withdrawals,
      },
      visa_payments: {
        relative: 0,
        static: 0,
        ...configuration.fees?.visa_payments,
      },
      ip_payments: {
        relative: 0,
        static: 0,
        ...configuration.fees?.ip_payments,
      },
    },
  };
};

export const getPublicConfiguration = (configuration: Configuration): any => {
  configuration = getConfiguration(configuration);
  return {
    limits: {
      withdrawals: {
        minimal_amount: configuration.limits.withdrawals.minimal_amount,
      },
      deposits: {
        address_verification_threshold:
          configuration.limits.deposits.address_verification_threshold,
        identity_verification_threshold:
          configuration.limits.deposits.identity_verification_threshold,
      },
    },
    fees: {
      ip_payments: _.pick(configuration.fees.ip_payments, "relative", "static"),
      visa_payments: _.pick(
        configuration.fees.visa_payments,
        "relative",
        "static"
      ),
      withdrawals: _.pick(configuration.fees.withdrawals, "relative", "static"),
      transfers: _.pick(configuration.fees.transfers, "relative", "static"),
      transfers_currency_conversion: _.pick(
        configuration.fees.transfers_currency_conversion,
        "relative",
        "static"
      ),
    },
  };
};
